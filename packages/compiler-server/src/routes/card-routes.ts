import { CardStackContext } from '@cardstack/compiler-server/src/interfaces';
import { NotFound } from '../middleware/errors';
import { RouterContext } from '@koa/router';
import { deserialize, serializeCard, serializeRawCard } from '../utils/serialization';
import { getCardFormatFromRequest } from '../utils/routes';
import { assertValidKeys } from '@cardstack/core/src/interfaces';
import Router from '@koa/router';

async function getCard(ctx: RouterContext<any, CardStackContext>) {
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

async function createDataCard(ctx: RouterContext<any, CardStackContext>) {
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

  let rawCard = await realms.getRealm(realmURL).createDataCard(data.attributes, parentCardURL, data.id);

  let compiledCard = await builder.getCompiledCard(rawCard.url);

  let format = getCardFormatFromRequest(ctx.query.format);

  ctx.body = await serializeCard(compiledCard.url, rawCard.data, compiledCard[format]);
  ctx.status = 201;
}

async function updateCard(ctx: RouterContext<any, CardStackContext>) {
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

async function deleteCard(ctx: RouterContext<any, CardStackContext>) {
  let {
    realms,
    params: { encodedCardURL: url },
  } = ctx;

  if (!realms.doesCardExist(url)) {
    throw new NotFound(`Card ${url} does not exist`);
  }

  realms.deleteCard(url);

  ctx.status = 204;
  ctx.body = null;
}

function assertValidRouterInstance(router: any, routeCard: string): void {
  const ROUTER_METHOD_NAME = 'routeTo';
  if (typeof router[ROUTER_METHOD_NAME] !== 'function') {
    throw new Error(
      `Route Card's Schema does not have proper routing method defined.
      Please make sure ${routeCard} schema has a ${ROUTER_METHOD_NAME} method`
    );
  }
}

async function respondWithCardForPath(ctx: RouterContext<any, CardStackContext>) {
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

async function setupCardRouting(context: CardStackContext, options: { routeCard: string }) {
  let { routeCard } = options;
  let card = await context.builder.getCompiledCard(routeCard);
  const CardRouterClass = context.requireCard(card.schemaModule).default;
  const cardRouterInstance = new CardRouterClass();

  assertValidRouterInstance(cardRouterInstance, routeCard);

  context.cardRouter = cardRouterInstance;
}

function unimpl() {
  throw new Error('unimplemented');
}

async function getSource(ctx: RouterContext<any, CardStackContext>) {
  let {
    realms,
    builder,
    params: { encodedCardURL: url },
    query,
  } = ctx;

  let compiledCard;
  let rawCard = await realms.getRawCard(url);

  if (query.include === 'compiledMeta') {
    compiledCard = await builder.getCompiledCard(url);
  }

  ctx.body = serializeRawCard(rawCard, compiledCard);
}

export async function cardRoutes(
  context: CardStackContext,
  routeCard: string | undefined
): Promise<Router<{}, CardStackContext>> {
  if (routeCard) {
    await setupCardRouting(context, { routeCard });
  }

  let koaRouter = new Router<{}, CardStackContext>();
  // the 'cards' section of the API deals in card data. The shape of the data
  // on these endpoints is determined by each card's own schema.
  koaRouter.post(`/cards/:realmURL/:parentCardURL`, createDataCard);
  koaRouter.get(`/cards/:encodedCardURL`, getCard);
  koaRouter.patch(`/cards/:encodedCardURL`, updateCard);
  koaRouter.delete(`/cards/:encodedCardURL`, deleteCard);

  // the 'sources' section of the API deals in RawCards. It's where you can do
  // CRUD operations on the sources themselves. It's a superset of what you
  // can do via the 'cards' section.
  koaRouter.post(`/sources/new`, unimpl);
  koaRouter.get(`/sources/:encodedCardURL`, getSource);
  koaRouter.patch(`/sources/:encodedCardURL`, unimpl);
  koaRouter.delete(`/sources/:encodedCardURL`, unimpl);

  // card-based routing is a layer on top of the 'cards' section where you can
  // fetch card data indirectly.
  koaRouter.get('/cardFor/:pathname', respondWithCardForPath);

  return koaRouter;
}
