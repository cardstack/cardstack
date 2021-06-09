import { CardStackContext } from '@cardstack/server/src/interfaces';
import { assertValidRawCard } from '@cardstack/core/src/interfaces';
import { NotFound } from '../middleware/errors';
import { RouterContext } from '@koa/router';
import { deserialize, serializeCard } from '../utils/serialization';
import { getCardFormatFromRequest } from '../utils/routes';

export async function respondWithCardForPath(
  ctx: RouterContext<any, CardStackContext>
) {
  let {
    builder,
    cardRouter,
    params: { pathname },
  } = ctx;

  if (!cardRouter) {
    throw Error('Card routing not configured for this server');
  }

  let url = cardRouter.routeTo(pathname);

  if (!url) {
    throw new NotFound(`No card defined for route ${pathname}`);
  }

  let card = await builder.getCompiledCard(url);
  ctx.body = await serializeCard(card, 'isolated');
  ctx.status = 200;
}

export async function getCard(ctx: RouterContext<any, CardStackContext>) {
  let {
    builder,
    params: { encodedCardURL: url },
  } = ctx;

  let format = getCardFormatFromRequest(ctx.query.format);
  let card = await builder.getCompiledCard(url);
  ctx.body = await serializeCard(card, format);
  ctx.status = 200;
}

export async function createDataCard(
  ctx: RouterContext<any, CardStackContext>
) {
  let {
    builder,
    request: { body },
    params: { encodedCardURL: url },
  } = ctx;

  body.url = url;

  // TODO: Assert adopts from exists and is valid
  // TODO: Assert data is the only other key
  // TODO: Assert data keys are actual fields on the card

  let card = await builder.compileCardFromRaw(url, body);
  let format = getCardFormatFromRequest(ctx.query.format);
  ctx.body = await serializeCard(card, format);
  ctx.status = 201;
}

export async function updateCard(ctx: RouterContext<any, CardStackContext>) {
  let {
    builder,
    request: { body },
    params: { encodedCardURL: url },
  } = ctx;

  let data = await deserialize(body);
  let card = await builder.updateCardData(url, data);

  ctx.body = await serializeCard(card, 'isolated');
  ctx.status = 200;
}

export async function deleteCard(ctx: RouterContext<any, CardStackContext>) {
  let {
    builder,
    params: { encodedCardURL: url },
  } = ctx;

  builder.deleteCard(url);

  ctx.status = 204;
  ctx.body = null;
}
