import Koa from "koa";
import Router from "@koa/router";

export async function createServer(realms: Record<string, string>) {
  let app = new Koa();
  let router = new Router();

  // The card data layer
  router.get("/realms/:local_realm_name/:local_id", (ctx) => {
    ctx.body = JSON.stringify({ realms, meta: import.meta }, null, 2);
    ctx.set("content-type", "application/json");
  });

  app.use(router.routes());
  app.use(router.allowedMethods());
  return app;
}
