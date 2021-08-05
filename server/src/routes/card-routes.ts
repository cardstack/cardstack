import { CardStackContext } from '@cardstack/server/src/interfaces';
import { NotFound } from '../middleware/errors';
import { RouterContext } from '@koa/router';
import { deserialize, serializeCard } from '../utils/serialization';
import { getCardFormatFromRequest } from '../utils/routes';
import { assertValidKeys } from '@cardstack/core/src/interfaces';

export async function respondWithCardForPath(
  ctx: RouterContext<any, CardStackContext>
) {
  let {
    builder,
    realms,
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

  let rawCard = await realms.getRawCard(url);
  let card = await builder.getCompiledCard(url);
  ctx.body = await serializeCard(url, rawCard.data, card['isolated']);
  ctx.status = 200;
}

export async function getCard(ctx: RouterContext<any, CardStackContext>) {
  let {
    builder,
    realms,
    params: { encodedCardURL: url },
  } = ctx;

  let format = getCardFormatFromRequest(ctx.query.format);
  let rawCard = await realms.getRawCard(url);
  let card = await builder.getCompiledCard(url);
  ctx.body = await serializeCard(url, rawCard.data, card[format]);
  ctx.status = 200;
}

export async function createDataCard(
  ctx: RouterContext<any, CardStackContext>
) {
  let {
    builder,
    realms,
    request: { body },
    params: { parentCardURL, realmURL },
  } = ctx;

  if (typeof body === 'string') {
    throw new Error('Request body is a string and it shouldnt be');
  }

  assertValidKeys(
    Object.keys(body),
    ['adoptsFrom', 'data', 'url'],
    'Payload contains keys that we do not allow: %list%'
  );

  let data = body.data as any;

  let rawCard = await realms
    .getRealm(realmURL)
    .createDataCard(data.attributes, parentCardURL, data.id);

  let compiledCard = await builder.getCompiledCard(rawCard.url);

  let format = getCardFormatFromRequest(ctx.query.format);

  ctx.body = await serializeCard(
    compiledCard.url,
    rawCard.data,
    compiledCard[format]
  );
  ctx.status = 201;
}

export async function updateCard(ctx: RouterContext<any, CardStackContext>) {
  let {
    builder,
    realms,
    request: { body },
    params: { encodedCardURL: url },
  } = ctx;

  let data = await deserialize(body);
  let rawCard = await realms.updateCardData(url, data.attributes);

  let card = await builder.getCompiledCard(url);

  // Question: Is it safe to assume the response should be isolated?
  ctx.body = await serializeCard(url, rawCard.data, card['isolated']);
  ctx.status = 200;
}

export async function deleteCard(ctx: RouterContext<any, CardStackContext>) {
  let {
    builder,
    realms,
    params: { encodedCardURL: url },
  } = ctx;

  if (!realms.doesCardExist(url)) {
    throw new NotFound(`Card ${url} does not exist`);
  }

  builder.deleteCard(url);

  ctx.status = 204;
  ctx.body = null;
}
