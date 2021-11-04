import { RouterContext } from '@koa/router';
import { deserialize, serializeCard, serializeRawCard } from '../utils/serialization';
import { getCardFormatFromRequest } from '../utils/routes';
import Router from '@koa/router';
import { inject } from '@cardstack/di';
import autoBind from 'auto-bind';
import { parseBody } from '../middleware';
import { INSECURE_CONTEXT } from '../services/card-service';
import { NotFound, BadRequest } from '@cardstack/core/src/utils/errors';
import { difference } from 'lodash';

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
  cards = inject('card-service', { as: 'cards' });

  routingCard?: any;

  constructor() {
    autoBind(this);
  }

  private async getCard(ctx: RouterContext) {
    let {
      params: { encodedCardURL: url },
    } = ctx;

    let format = getCardFormatFromRequest(ctx.query.format);
    let { data, compiled } = await this.cards.as(INSECURE_CONTEXT).load(url);
    ctx.body = await serializeCard(url, data, compiled[format]);
    ctx.status = 200;
  }

  private async createDataCard(ctx: RouterContext) {
    let {
      request: { body },
      params: { parentCardURL, realmURL },
    } = ctx;

    if (typeof body === 'string') {
      throw new Error('Request body is a string and it shouldnt be');
    }

    let unexpectedFields = difference(Object.keys(body), ['adoptsFrom', 'data', 'url']);
    if (unexpectedFields.length) {
      throw new BadRequest(`Payload contains keys that we do not allow: ${unexpectedFields.join(',')}`);
    }

    let inputData = body.data;
    let format = getCardFormatFromRequest(ctx.query.format);

    let card: any = {
      adoptsFrom: parentCardURL,
      data: inputData.attributes,
    };
    if (inputData.id) {
      card.url = inputData.id;
    }

    let { data: outputData, compiled } = await this.cards.as(INSECURE_CONTEXT).create(card, { realmURL });

    ctx.body = await serializeCard(compiled.url, outputData, compiled[format]);
    ctx.status = 201;
  }

  private async updateCard(ctx: RouterContext) {
    let {
      request: { body },
      params: { encodedCardURL: url },
    } = ctx;

    let data = await deserialize(body).attributes;
    let { data: outputData, compiled } = await this.cards.as(INSECURE_CONTEXT).update({ url, data });

    // Question: Is it safe to assume the response should be isolated?
    ctx.body = await serializeCard(url, outputData, compiled['isolated']);
    ctx.status = 200;
  }

  private async deleteCard(ctx: RouterContext) {
    let {
      params: { encodedCardURL: url },
    } = ctx;

    await this.realmManager.getRealm(url).delete(url);
    this.cache.deleteCard(url);

    ctx.status = 204;
    ctx.body = null;
  }

  private async respondWithCardForPath(ctx: RouterContext) {
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

    let rawCard = await this.realmManager.read(url);
    let card = await this.builder.getCompiledCard(url);
    ctx.body = await serializeCard(url, rawCard.data, card['isolated']);
    ctx.status = 200;
  }

  private async getSource(ctx: RouterContext) {
    let {
      params: { encodedCardURL: url },
      query,
    } = ctx;

    let compiledCard;
    let rawCard = await this.realmManager.read(url);

    if (query.include === 'compiledMeta') {
      compiledCard = await this.builder.getCompiledCard(url);
    }

    ctx.body = serializeRawCard(rawCard, compiledCard);
  }

  // TODO: How will we do this NOW?
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
    koaRouter.get(`/cards/`, unimpl);
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

declare module '@cardstack/di' {
  interface KnownServices {
    'card-routes': CardRoutes;
  }
}
