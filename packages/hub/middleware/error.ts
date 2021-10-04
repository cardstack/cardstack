import type Koa from 'koa';

export default async function error(ctxt: Koa.Context, next: Koa.Next) {
  try {
    return await next();
  } catch (err: any) {
    if (!err.isCardstackError) {
      throw err;
    }
    if (err.status === 500) {
      console.error(`Unexpected error: ${err.status} - ${err.message}\n${err.stack}`); // eslint-disable-line no-console
    }
    let errors = [err];
    if (err.additionalErrors) {
      errors = errors.concat(err.additionalErrors);
    }
    ctxt.body = { errors };
    ctxt.status = errors[0].status;
  }
}
