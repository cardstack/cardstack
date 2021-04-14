import { Error as JSONAPIError } from 'jsonapi-serializer';
export class NotFound extends Error {
  status = 404;
}

export function setErrorResponse(ctx: any, err: any) {
  let status = err.status ?? '500';
  let title = err.message ?? 'An unexpected exception occured';

  ctx.response.status = parseInt(status);
  ctx.body = new JSONAPIError({
    status,
    title,
  });
}
