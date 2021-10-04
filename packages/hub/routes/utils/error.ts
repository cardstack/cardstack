import Koa from 'koa';
export function handleError(ctx: Koa.Context, statusCode: number, title: string, detail?: string) {
  let error: { status: string; title: string; detail?: string } = {
    status: `${statusCode}`,
    title,
  };
  if (detail) {
    error.detail = detail;
  }

  ctx.status = statusCode;
  ctx.body = {
    errors: [error],
  };
  ctx.type = 'application/vnd.api+json';
}
