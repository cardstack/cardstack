import { Builder } from './../../../core/src/interfaces';
import { RouterContext } from '@koa/router';
import { setErrorResponse } from '../error';
import { Serializer } from 'jsonapi-serializer';

export async function cardRoute(ctx: RouterContext, builder: Builder) {
  // TODO: get query param
  let format: 'isolated' | 'embedded' = 'isolated';
  let url = ctx.params.encodedCardURL;

  try {
    let card = await builder.getCompiledCard(url);
    ctx.set('content-type', 'application/json');
    let cardSerializer = new Serializer('card', {
      attributes: card[format].usedFields,
      dataMeta: {
        componentModule: card[format].moduleName,
      },
    });

    ctx.body = cardSerializer.serialize(card.data);
  } catch (err) {
    setErrorResponse(ctx, err);
  }
}
