import { cardJSONReponse } from '@cardstack/server/src/interfaces';
import {
  assertValidRawCard,
  CompiledCard,
  Format,
  FORMATS,
} from '@cardstack/core/src/interfaces';
import { NotFound } from '../middleware/error';
import { Serializer } from 'jsonapi-serializer';

const DEFAULT_FORMAT = 'isolated';

function assertValidFormat(format: string): asserts format is Format {
  if (format && !FORMATS.some((f) => f === format)) {
    // if (format && !FORMATS.includes(format)) { // Why does typescript complain about this?
    throw new Error(`Unknown format provided: ${format}`);
  }
}

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
    assertValidFormat(format);
    return format;
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

export async function respondWithCardForPath(ctx: any) {
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

export async function respondWithCard(ctx: any) {
  let {
    builder,
    params: { encodedCardURL: url },
  } = ctx;

  let format = getCardFormatFromRequest(ctx.query.format);
  let card = await builder.getCompiledCard(url);
  ctx.body = await serializeCard(card, format);
  ctx.status = 200;
}

export async function createCard(ctx: any) {
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

export async function updateCard(ctx: any) {
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

export async function deleteCard(ctx: any) {
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
