import { Builder, Format, formats } from './../../../core/src/interfaces';
import { RouterContext } from '@koa/router';
import { NotFound, setErrorResponse } from '../error';
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
  builder: Builder,
  ctx: RouterContext
) {
  let card = await builder.getCompiledCard(url);
  ctx.set('content-type', 'application/json');
  let cardSerializer = new Serializer('card', {
    attributes: card[format].usedFields,
    dataMeta: {
      componentModule: card[format].moduleName,
    },
  });
  let data = Object.assign({ id: card.url }, card.data);
  ctx.body = cardSerializer.serialize(data);
}

export async function respondWithCard(ctx: RouterContext, builder: Builder) {
  let format = getCardFormatFromRequest(ctx.query.format);
  let url = ctx.params.encodedCardURL;

  try {
    await serializeCard(url, format, builder, ctx);
  } catch (err) {
    setErrorResponse(ctx, err);
  }
}

export async function respondWithCardForPath(
  ctx: RouterContext,
  builder: Builder
) {
  // TODO: This should be dynamically part of the server config
  const SchemaClass = (
    await import('@cardstack/compiled/http-demo.com-cards-routes-schema.js')
  ).default;
  let { pathname } = ctx.params;

  let schema = new SchemaClass();
  let url = schema.routeTo(pathname);

  if (!url) {
    throw new NotFound(`No card defined for route ${pathname}`);
  }

  try {
    await serializeCard(url, 'isolated', builder, ctx);
  } catch (err) {
    setErrorResponse(ctx, err);
  }
}
