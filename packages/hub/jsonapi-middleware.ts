import compose from "koa-compose";
import route from "koa-better-route";
import Koa from "koa";
// @ts-ignore
import mimeMatch from "mime-match";
import KoaBody from 'koa-body';
import { Memoize } from "typescript-memoize";
import { inject } from "./dependency-injection";
import CardstackError from './error';

const apiPrefix = /^\/api\/(.*)/;

export default class JSONAPIMiddleware {
  cards = inject('cards');

  middleware() {
    return (ctxt: Koa.Context, next: Koa.Next) => {
      let m = apiPrefix.exec(ctxt.request.path);
      if (!m) {
        return next();
      }
      ctxt.request.path = `/${m[1]}`;

      if (this.isJSONAPI(ctxt)) {
        return this.jsonHandlers(ctxt, next);
      } else {
        throw new CardstackError(`not implemented`);
      }
    };
  }

  @Memoize()
  get jsonHandlers() {
    let body = KoaBody({
      jsonLimit: '16mb',
      multipart: false,
      urlencoded: false,
      text: false,
      jsonStrict: true,
      onError(error: Error) {
        throw new CardstackError(`error while parsing body: ${error.message}`, { status: 400 });
      }
    });

    return compose([
      CardstackError.withJsonErrorHandling,
      body,
      //route.get("/cards", getCards),
      route.post("/cards", this.createCard.bind(this))
      // route.get("/cards/:id", getCard),
      // route.patch("/cards/:id", updateCard),
      // route.delete("/cards/:id", deleteCard)
    ]);
  }

  isJSONAPI(ctxt: Koa.Context) {
    let contentType = ctxt.request.headers["content-type"];
    let isJsonApi =
      contentType && contentType.includes("application/vnd.api+json");
    let [acceptedTypes]: string[] = (
      ctxt.request.headers["accept"] || ""
    ).split(";");
    let types = acceptedTypes.split(",");
    let acceptsJsonApi = types.some(t =>
      mimeMatch(t, "application/vnd.api+json")
    );
    return isJsonApi || acceptsJsonApi;
  }

  private assertBodyPresent(ctxt: Koa.Context) {
    if (!ctxt.request.body || !ctxt.request.body.data) {
      throw new CardstackError('A JSON:API formatted body is required', {
        status: 400
      });
    }
  }

  createCard(ctxt: Koa.Context) {
    this.assertBodyPresent(ctxt);
    ctxt.response.body = "Hello world";
    ctxt.status = 201;
  }
}

declare module "@cardstack/hub/dependency-injection" {
  interface KnownServices {
    "jsonapi-middleware": JSONAPIMiddleware;
  }
}
