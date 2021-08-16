import Koa from 'koa';

export function ensureLoggedIn(ctx: Koa.Context): boolean {
  if (ctx.state.userAddress) {
    return true;
  }
  ctx.body = {
    errors: [
      {
        status: '401',
        title: 'No valid auth token',
      },
    ],
  };
  ctx.status = 401;
  ctx.type = 'application/vnd.api+json';
  return false;
}
