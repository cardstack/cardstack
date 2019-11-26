import compose from "koa-compose";
import route, { KoaRoute } from "koa-better-route";
import Koa from "koa";
// @ts-ignore
import mimeMatch from "mime-match";
import KoaBody from 'koa-body';
import { Memoize } from "typescript-memoize";
import { inject } from "./dependency-injection";
import CardstackError from './error';
import { SessionContext } from "./authentication-middleware";

const apiPrefix = '/api';
const apiPrefixPattern = new RegExp(`^${apiPrefix}/(.*)`);

export default class JSONAPIMiddleware {
  cards = inject('cards');

  middleware() {
    return (ctxt: Koa.ParameterizedContext<SessionContext, {}>, next: Koa.Next) => {
      let m = apiPrefixPattern.exec(ctxt.request.path);
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
      route.post("/realms/:local_realm_id", this.createCard.bind(this)),
      route.post("/remote-realms/:remote_realm", this.createCard.bind(this)),
      // route.get("/cards/:id", getCard),
      // route.patch("/cards/:id", updateCard),
      // route.delete("/cards/:id", deleteCard)
    ]);
  }

  isJSONAPI(ctxt: Koa.ParameterizedContext<{}, {}>) {
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

  async createCard(ctxt: KoaRoute.Context<SessionContext, {}>) {
    this.assertBodyPresent(ctxt);
    let realm: URL;
    if (ctxt.routeParams.local_realm_id) {
      realm = new URL(`${ctxt.request.origin}${apiPrefix}/realms/${ctxt.routeParams.local_realm_id}`);
    } else {
      // todo: test koa decoding behavior here
      realm = new URL(decodeURI(ctxt.routeParams.remote_realm));
    }
    let card = await this.cards.create(ctxt.state.cardstackSession, realm, ctxt.request.body);
    ctxt.body = card.jsonapi;
    ctxt.status = 201;
    ctxt.set('location', `${ctxt.request.origin}${apiPrefix}/cards/${card.id}`);
  }
}

declare module "@cardstack/hub/dependency-injection" {
  interface KnownServices {
    "jsonapi-middleware": JSONAPIMiddleware;
  }
}
