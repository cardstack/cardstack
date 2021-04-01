import Koa from "koa";
import Router from "@koa/router";
import Builder from "./builder";
import { RealmsConfig } from "./interfaces";
import { Serializer } from "jsonapi-serializer";

export async function createServer(realms: RealmsConfig): Promise<Koa> {
  let app = new Koa();
  let router = new Router();
  let builder = new Builder({ realms });

  // The card data layer
  router.get("/realms/:local_realm_name/:local_id", async (ctx) => {
    let cardSerializer = new Serializer(ctx.params.local_id, {
      attributes: [],
    });
    let { local_realm_name, local_id } = ctx.params;
    let url = builder.buildCardURL(local_realm_name, local_id);
    if (!url) {
      ctx.throw(404);
    }
    let card = await builder.getCompiledCard(url);

    ctx.set("content-type", "application/json");
    ctx.body = cardSerializer.serialize(card.data);
  });

  app.use(router.routes());
  app.use(router.allowedMethods());
  return app;
}
