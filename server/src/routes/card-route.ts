import {
  cardJSONReponse,
  CardStackContext,
} from '@cardstack/server/src/interfaces';
import {
  assertValidRawCard,
  CompiledCard,
  Format,
  isFormat,
} from '@cardstack/core/src/interfaces';
import { NotFound } from '../middleware/error';
import { Serializer } from 'jsonapi-serializer';
import { RouterContext } from '@koa/router';

const DEFAULT_FORMAT = 'isolated';

function getCardFormatFromRequest(
  formatQueryParam?: string | string[]
): Format {
  if (!formatQueryParam) {
    return DEFAULT_FORMAT;
  }

  let format;
  if (Array.isArray(formatQueryParam)) {
    format = formatQueryParam[0];
  } else {
    format = formatQueryParam;
  }

  if (format) {
    if (isFormat(format)) {
      return format;
    } else {
      throw new Error(`${format} is not a valid format`);
    }
  } else {
    return DEFAULT_FORMAT;
  }
}

async function serializeCard(
  card: CompiledCard,
  format: Format
): Promise<cardJSONReponse> {
  let cardSerializer = new Serializer('card', {
    attributes: card[format].usedFields,
    dataMeta: {
      componentModule: card[format].moduleName,
      deserializationMap: card[format].deserialize,
    },
  });
  let data = Object.assign({ id: card.url }, card.data);
  return cardSerializer.serialize(data);
}

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

export async function respondWithCard(
  ctx: RouterContext<any, CardStackContext>
) {
  let {
    builder,
    params: { encodedCardURL: url },
  } = ctx;

  let format = getCardFormatFromRequest(ctx.query.format);
  let card = await builder.getCompiledCard(url);
  ctx.body = await serializeCard(card, format);
  ctx.status = 200;
}

export async function createCard(ctx: RouterContext<any, CardStackContext>) {
  let {
    builder,
    request: { body },
    params: { encodedCardURL: url },
  } = ctx;

  body.url = url;

  assertValidRawCard(body);
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

  if (!builder.locateCardDir(url)) {
    throw new NotFound(`Card ${url} does not exist`);
  }

  body.url = url;

  assertValidRawCard(body);
  let card = await builder.compileCardFromRaw(url, body);
  let format = getCardFormatFromRequest(ctx.query.format);
  ctx.body = await serializeCard(card, format);
  ctx.status = 200;
}

export async function deleteCard(ctx: RouterContext<any, CardStackContext>) {
  let {
    builder,
    params: { encodedCardURL: url },
  } = ctx;

  if (!builder.locateCardDir(url)) {
    throw new NotFound(`Card ${url} does not exist`);
  }

  builder.deleteCard(url);

  ctx.status = 204;
  ctx.body = null;
}
