import { RouterContext } from '@koa/router';
import { CardStackContext } from '../interfaces';
import { NotFound } from './errors';

export async function assertCardExists(
  ctx: RouterContext<any, CardStackContext>
) {
  let {
    builder,
    params: { encodedCardURL: url },
  } = ctx;

  if (!builder.locateCardDir(url)) {
    throw new NotFound(`Card ${url} does not exist`);
  }
}
