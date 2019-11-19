import Koa from 'koa';

export async function makeServer() {
  return new Koa();
}
