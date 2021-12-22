import { RouterContext } from '@koa/router';
import { getCardFormatFromRequest } from '../utils/routes';
import Router from '@koa/router';
import { inject } from '@cardstack/di';
import autoBind from 'auto-bind';
import { parseBody } from '../middleware';
import { INSECURE_CONTEXT } from '../services/card-service';
import { NotFound, BadRequest, CardstackError } from '@cardstack/core/src/utils/errors';
import { difference } from 'lodash';
import { assertQuery } from '@cardstack/core/src/query';
import qs from 'qs';
import { serializeCardPayloadForFormat, RawCardSerializer } from '@cardstack/core/src/serializers';
import { RawCard, Unsaved } from '@cardstack/core/src/interfaces';

declare global {
  const __non_webpack_require__: any;
}

const requireCard = function (path: string, root: string): any {
  const module = __non_webpack_require__.resolve(path, {
    paths: [root],
  });
  return __non_webpack_require__(module);
};

export default class CardRoutes {
  private realmManager = inject('realm-manager', { as: 'realmManager' });
  private cache = inject('card-cache', { as: 'cache' });
  private builder = inject('card-builder', { as: 'builder' });
  private cards = inject('card-service', { as: 'cards' });
  private config = inject('card-routes-config', { as: 'config' });
  private index = inject('searchIndex', { as: 'index' });

  private routerInstance: undefined | RouterInstance;

  constructor() {
    autoBind(this);
  }

  private async getCard(ctx: RouterContext) {
    let {
      params: { encodedCardURL: url },
    } = ctx;

    let format = getCardFormatFromRequest(ctx.query.format);
    let card = await this.cards.as(INSECURE_CONTEXT).load(url);
    ctx.body = serializeCardPayloadForFormat(card, format);
    ctx.status = 200;
  }

  private async queryCards(ctx: RouterContext) {
    let query = qs.parse(ctx.querystring);
    assertQuery(query);
    let cards = await this.cards.as(INSECURE_CONTEXT).query(query);
    let collection = cards.map((card) => serializeCardPayloadForFormat(card, 'embedded').data);
    ctx.body = { data: collection };
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

    let card: RawCard<Unsaved> = {
      id: undefined,
      realm: realmURL,
      adoptsFrom: parentCardURL,
      data: inputData.attributes,
    };
    if (inputData.id) {
      card.id = inputData.id.slice(realmURL.length);
    }

    let createdCard = await this.cards.as(INSECURE_CONTEXT).create(card);
    ctx.body = serializeCardPayloadForFormat(createdCard, format);
    ctx.status = 201;
  }

  private async updateCard(ctx: RouterContext) {
    let {
      request: { body: data },
      params: { encodedCardURL: url },
    } = ctx;

    let cardId = this.realmManager.parseCardURL(url);
    let card = await this.cards.as(INSECURE_CONTEXT).update({ ...cardId, data });
    // Question: Is it safe to assume the response should be isolated?
    ctx.body = serializeCardPayloadForFormat(card, 'isolated');
    ctx.status = 200;
  }

  private async deleteCard(ctx: RouterContext) {
    let {
      params: { encodedCardURL: url },
    } = ctx;

    await this.realmManager.delete(this.realmManager.parseCardURL(url));
    this.cache.deleteCard(url);

    ctx.status = 204;
    ctx.body = null;
  }

  private async respondWithCardForPath(ctx: RouterContext) {
    let routerInstance = await this.ensureRouterInstance();

    let {
      params: { pathname },
    } = ctx;

    let url = routerInstance.routeTo(pathname);

    if (!url) {
      throw new NotFound(`No card defined for route ${pathname}`);
    }

    let card = await this.cards.as(INSECURE_CONTEXT).load(url);
    ctx.body = serializeCardPayloadForFormat(card, 'isolated');
  }

  private async getSource(ctx: RouterContext) {
    let {
      params: { encodedCardURL: url },
      query,
    } = ctx;

    let card = await this.index.getCard(url);
    let compiledCard;

    if (query.include === 'compiledMeta') {
      compiledCard = card.compiled;
    }
    let data = new RawCardSerializer().serialize(card.raw, compiledCard);
    ctx.body = data;
  }

  private async ensureRouterInstance(): Promise<RouterInstance> {
    if (!this.routerInstance) {
      if (!this.config.routeCard) {
        this.routerInstance = defaultRouterInstance;
      } else {
        let { compiled } = await this.index.getCard(this.config.routeCard);
        if (!compiled) {
          throw new CardstackError('Routing card is not compiled!');
        }
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const CardRouterClass = requireCard(compiled.schemaModule.global, this.cache.dir).default;
        const cardRouterInstance = new CardRouterClass();
        assertValidRouterInstance(cardRouterInstance, this.config.routeCard);
        this.routerInstance = cardRouterInstance;
      }
    }
    return this.routerInstance;
  }

  routes(): Router.Middleware {
    // eslint-disable-next-line @typescript-eslint/ban-types
    let koaRouter = new Router();

    // the 'cards' section of the API deals in card data. The shape of the data
    // on these endpoints is determined by each card's own schema.
    koaRouter.post(`/cards/:realmURL/:parentCardURL`, parseBody, this.createDataCard);
    koaRouter.get(`/cards/`, this.queryCards);
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

interface RouterInstance {
  routeTo(path: string): string;
}

function assertValidRouterInstance(router: any, routeCard: string): asserts router is RouterInstance {
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

const defaultRouterInstance = {
  routeTo(_path: string) {
    throw new NotFound('Card routing not configured for this server');
  },
};

declare module '@cardstack/di' {
  interface KnownServices {
    'card-routes': CardRoutes;
    'card-routes-config': CardRoutesConfig;
  }
}

class CardRoutesConfig {
  routeCard?: string;
}
