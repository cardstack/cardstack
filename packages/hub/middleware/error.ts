import type Koa from 'koa';

export default async function error(ctxt: Koa.Context, next: Koa.Next) {
  try {
    return await next();
  } catch (err: any) {
    if (!err.isCardstackError) {
      throw err;
    }

    let errors = [err];
    if (err.additionalErrors) {
      errors = errors.concat(err.additionalErrors);
    }
    ctxt.status = err.status;
    ctxt.body = { errors };
  }
}
