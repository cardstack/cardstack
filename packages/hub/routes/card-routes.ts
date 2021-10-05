// import { CardStackContext } from '../interfaces';
import { BadRequest, NotFound } from '../utils/error';
import { RouterContext } from '@koa/router';
import { deserialize, serializeCard, serializeRawCard } from '../utils/serialization';
import { getCardFormatFromRequest } from '../utils/routes';
import { assertValidKeys } from '@cardstack/core/src/interfaces';
import Router from '@koa/router';
import { inject } from '../di/dependency-injection';
import autoBind from 'auto-bind';
import { parseBody } from '../middleware';

const requireCard = function (path: string, root: string): any {
  const module = require.resolve(path, {
    paths: [root],
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(module);
};

export default class CardRoutes {
  realmManager = inject('realm-manager', { as: 'realmManager' });
  cache = inject('card-cache', { as: 'cache' });
  builder = inject('card-builder', { as: 'builder' });

  routingCard?: any;

  constructor() {
    autoBind(this);
  }

  async getCard(ctx: RouterContext) {
    let {
      params: { encodedCardURL: url },
    } = ctx;

    let format = getCardFormatFromRequest(ctx.query.format);
    let rawCard = await this.realmManager.getRawCard(url);
    let card = await this.builder.getCompiledCard(url);
    ctx.body = await serializeCard(url, rawCard.data, card[format]);
    ctx.status = 200;
  }

  async createDataCard(ctx: RouterContext) {
    let {
      request: { body },
      params: { parentCardURL, realmURL },
    } = ctx;

    if (typeof body === 'string') {
      throw new Error('Request body is a string and it shouldnt be');
    }

    assertValidKeys(
      Object.keys(body),
      ['adoptsFrom', 'data', 'url'],
      'Payload contains keys that we do not allow: %list%',
      BadRequest
    );

    let data = body.data as any;
    let rawCard = await this.realmManager.getRealm(realmURL).createDataCard(data.attributes, parentCardURL, data.id);
    let compiledCard = await this.builder.getCompiledCard(rawCard.url);
    let format = getCardFormatFromRequest(ctx.query.format);
    ctx.body = await serializeCard(compiledCard.url, rawCard.data, compiledCard[format]);
    ctx.status = 201;
  }

  async updateCard(ctx: RouterContext) {
    let {
      request: { body },
      params: { encodedCardURL: url },
    } = ctx;

    let data = await deserialize(body);
    let rawCard = await this.realmManager.updateCardData(url, data.attributes);

    let card = await this.builder.getCompiledCard(url);

    // Question: Is it safe to assume the response should be isolated?
    ctx.body = await serializeCard(url, rawCard.data, card['isolated']);
    ctx.status = 200;
  }

  async deleteCard(ctx: RouterContext) {
    let {
      params: { encodedCardURL: url },
    } = ctx;

    if (!this.realmManager.doesCardExist(url)) {
      throw new NotFound(`Card ${url} does not exist`);
    }

    this.realmManager.deleteCard(url);
    this.cache.deleteCard(url);

    ctx.status = 204;
    ctx.body = null;
  }

  async respondWithCardForPath(ctx: RouterContext) {
    let { routingCard } = this;
    let {
      params: { pathname },
    } = ctx;

    if (!routingCard) {
      throw Error('Card routing not configured for this server');
    }

    let url = routingCard.routeTo(pathname);

    if (!url) {
      throw new NotFound(`No card defined for route ${pathname}`);
    }

    let rawCard = await this.realmManager.getRawCard(url);
    let card = await this.builder.getCompiledCard(url);
    ctx.body = await serializeCard(url, rawCard.data, card['isolated']);
    ctx.status = 200;
  }

  async getSource(ctx: RouterContext) {
    let {
      params: { encodedCardURL: url },
      query,
    } = ctx;

    let compiledCard;
    let rawCard = await this.realmManager.getRawCard(url);

    if (query.include === 'compiledMeta') {
      compiledCard = await this.builder.getCompiledCard(url);
    }

    ctx.body = serializeRawCard(rawCard, compiledCard);
  }

  async setRoutingCard(routeCard: string) {
    let card = await this.builder.getCompiledCard(routeCard);
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const CardRouterClass = requireCard(card.schemaModule, this.cache.dir).default;
    const cardRouterInstance = new CardRouterClass();

    assertValidRouterInstance(cardRouterInstance, routeCard);

    this.routingCard = cardRouterInstance;
  }

  routes(): Router.Middleware {
    // eslint-disable-next-line @typescript-eslint/ban-types
    let koaRouter = new Router();

    // the 'cards' section of the API deals in card data. The shape of the data
    // on these endpoints is determined by each card's own schema.
    koaRouter.post(`/cards/:realmURL/:parentCardURL`, parseBody, this.createDataCard);
    koaRouter.get(`/cards/:encodedCardURL`, this.getCard);
    koaRouter.patch(`/cards/:encodedCardURL`, parseBody, this.updateCard);
    koaRouter.delete(`/cards/:encodedCardURL`, this.deleteCard);

    // the 'sources' section of the API deals in RawCards. It's where you can do
    // CRUD operations on the sources themselves. It's a superset of what you
    // can do via the 'cards' section.
    koaRouter.post(`/sources/new`, parseBody, unimpl);
    koaRouter.get(`/sources/:encodedCardURL`, this.getSource);
    koaRouter.patch(`/sources/:encodedCardURL`, parseBody, unimpl);
    koaRouter.delete(`/sources/:encodedCardURL`, unimpl);

    // card-based routing is a layer on top of the 'cards' section where you can
    // fetch card data indirectly.
    koaRouter.get('/cardFor/:pathname', this.respondWithCardForPath);
    return koaRouter.routes();
  }
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

function unimpl() {
  throw new Error('unimplemented');
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'card-routes': CardRoutes;
  }
}
