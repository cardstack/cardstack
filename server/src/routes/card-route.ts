import { Builder, Format, formats } from '@cardstack/core/src/interfaces';
import { NotFound } from '../middleware/error';
import { Serializer } from 'jsonapi-serializer';

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

async function serializeCard(
  url: string,
  format: Format,
  builder: Builder
): Promise<any> {
  let card = await builder.getCompiledCard(url);
  let cardSerializer = new Serializer('card', {
    attributes: card[format].usedFields,
    dataMeta: {
      componentModule: card[format].moduleName,
    },
  });
  let data = Object.assign({ id: card.url }, card.data);
  return cardSerializer.serialize(data);
}

export async function respondWithCard(ctx: any) {
  let { builder } = ctx;
  let format = getCardFormatFromRequest(ctx.query.format);
  let url = ctx.params.encodedCardURL;

  ctx.body = await serializeCard(url, format, builder);
  ctx.status = 200;
}

export async function respondWithCardForPath(ctx: any) {
  let {
    builder,
    cardRouter,
    params: { pathname },
  } = ctx;

  let url = cardRouter.routeTo(pathname);

  if (!url) {
    throw new NotFound(`No card defined for route ${pathname}`);
  }

  ctx.body = await serializeCard(url, 'isolated', builder);
  ctx.status = 200;
}
