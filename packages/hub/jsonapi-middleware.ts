import compose from "koa-compose";
import route from "koa-better-route";
import Koa from "koa";

export default class JSONAPIMiddleware {
  middleware() {
    return compose([
      //route.get("/cards", getCards),
      route.post("/api/cards", this.createCard.bind(this))
      // route.get("/cards/:id", getCard),
      // route.patch("/cards/:id", updateCard),
      // route.delete("/cards/:id", deleteCard)
    ]);
  }

  createCard(ctxt: Koa.Context) {
    ctxt.body = "Hello world";
    ctxt.status = 200;
  }
}

declare module "@cardstack/hub/dependency-injection" {
  interface KnownServices {
    "jsonapi-middleware": JSONAPIMiddleware;
  }
}
