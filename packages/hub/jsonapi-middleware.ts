import compose from "koa-compose";
import route from "koa-better-route";
import Koa from "koa";
// @ts-ignore
import mimeMatch from "mime-match";
import { Memoize } from "typescript-memoize";

const apiPrefix = /^\/api\/(.*)/;

export default class JSONAPIMiddleware {
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
        throw new Error(`not implemented`);
      }
    };
  }

  @Memoize()
  get jsonHandlers() {
    return compose([
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

  createCard(ctxt: Koa.Context) {
    ctxt.body = "Hello world";
    ctxt.status = 201;
  }
}

declare module "@cardstack/hub/dependency-injection" {
  interface KnownServices {
    "jsonapi-middleware": JSONAPIMiddleware;
  }
}
