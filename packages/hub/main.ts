import Koa from 'koa';
import logger from '@cardstack/logger';
const log = logger('cardstack/server');

export async function makeServer() {
  let app = new Koa();
  app.use(httpLogging);
  return app;
}

async function httpLogging(ctxt: Koa.Context, next: Koa.Next) {
  log.info('start %s %s', ctxt.request.method, ctxt.request.originalUrl);
  await next();
  log.info('finish %s %s %s', ctxt.request.method, ctxt.request.originalUrl, ctxt.response.status);
}
