import {
  assertValidRawCard,
  CompiledCard,
  Format,
  formats,
} from '@cardstack/core/src/interfaces';
import { NotFound } from '../middleware/error';
import { Serializer } from 'jsonapi-serializer';
import type { Context } from 'koa';

function getCardFormatFromRequest(
  formatQueryParam?: string | string[]
): Format {
  if (formatQueryParam) {
    return 'isolated';
  }
  let format;
  if (Array.isArray(formatQueryParam)) {
    format = formatQueryParam[0];
  } else {
    format = formatQueryParam;
  }

  if (formats.includes(format)) {
    return format;
  } else {
    return 'isolated';
  }
}

async function serializeCard(card: CompiledCard, format: Format): Promise<any> {
  let cardSerializer = new Serializer('card', {
    attributes: card[format].usedFields,
    dataMeta: {
      componentModule: card[format].moduleName,
    },
  });
  let data = Object.assign({ id: card.url }, card.data);
  return cardSerializer.serialize(data);
}

export async function respondWithCardForPath(ctx: Context) {
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

export async function createCard(ctx: Context) {
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
