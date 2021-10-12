import type Koa from 'koa';

export default async function error(ctxt: Koa.Context, next: Koa.Next) {
  try {
    return await next();
  } catch (err: any) {
    if (!err.isCardstackError && !err.isCompilerError) {
      throw err;
    }
    if (err.status === 500) {
      console.error(`Unexpected error: ${err.status} - ${err.message}\n${err.stack}`); // eslint-disable-line no-console
    }
    if (err.isCompilerError) {
      // TODO: This probably needs to be expanded
      err.status = 400;
      err.title = 'Bad Request';
    }
    let errors = [err];
    if (err.additionalErrors) {
      errors = errors.concat(err.additionalErrors);
    }
    ctxt.status = err.status;
    ctxt.body = { errors };
  }
}
