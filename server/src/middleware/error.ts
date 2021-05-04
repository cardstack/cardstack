import { Error as JSONAPIError } from 'jsonapi-serializer';
export class NotFound extends Error {
  status = 404;
}
export class BadRequest extends Error {
  status = 400;
}

export async function errorMiddleware(ctx: any, next: any) {
  try {
    await next();
  } catch (err) {
    let status = err.status ?? '500';
    let title = err.message ?? 'An unexpected exception occured';

    ctx.status = parseInt(status);
    ctx.body = new JSONAPIError({
      status,
      title,
    });

    // console.error(err);
  }
}
