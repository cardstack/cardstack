import { RouterContext } from '@koa/router';
import { CardStackContext } from '../interfaces';
import { NotFound } from './errors';

export async function assertCardExists(
  ctx: RouterContext<any, CardStackContext>,
  next: any
) {
  let {
    realms,
    params: { encodedCardURL: url },
  } = ctx;

  if (!realms.doesCardExist(url)) {
    throw new NotFound(`Card ${url} does not exist`);
  }

  await next();
}
