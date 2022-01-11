import { RouterContext } from '@koa/router';
import { getCardFormatFromRequest } from '../utils/routes';
import Router from '@koa/router';
import { inject } from '@cardstack/di';
import autoBind from 'auto-bind';
import { parseBody } from '../middleware';
import { INSECURE_CONTEXT } from '../services/card-service';
import { NotFound, CardstackError } from '@cardstack/core/src/utils/errors';
import { parseQueryString } from '@cardstack/core/src/query';
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
  private cache = inject('file-cache', { as: 'cache' });
  private cards = inject('card-service', { as: 'cards' });
  private config = inject('card-routes-config', { as: 'config' });

  private routerInstance: undefined | RouterInstance;

  constructor() {
    autoBind(this);
  }

  private async getCard(ctx: RouterContext) {
    let {
      params: { encodedCardURL: url },
    } = ctx;

    let format = getCardFormatFromRequest(ctx.query.format);
    let card = await this.cards.as(INSECURE_CONTEXT).loadData(url, format);
    ctx.body = serializeCardPayloadForFormat(card);
    ctx.status = 200;
  }

  private async queryCards(ctx: RouterContext) {
    let query = parseQueryString(ctx.querystring);
    let cards = await this.cards.as(INSECURE_CONTEXT).query('embedded', query);
    let collection = cards.map((card) => serializeCardPayloadForFormat(card).data);
    ctx.body = { data: collection };
    ctx.status = 200;
  }

  private async createCardFromData(ctx: RouterContext) {
    let {
      request: {
        body: { data },
      },
      params: { parentCardURL, realmURL },
    } = ctx;

    let format = getCardFormatFromRequest(ctx.query.format);

    let card: RawCard<Unsaved> = {
      id: undefined,
      realm: realmURL,
      adoptsFrom: parentCardURL,
      data: data.attributes,
    };
    if (data.id) {
      card.id = data.id.slice(realmURL.length);
    }

    let createdCard = await this.cards.as(INSECURE_CONTEXT).createData(card, format);
    ctx.body = serializeCardPayloadForFormat(createdCard);
    ctx.status = 201;
  }

  private async updateCardData(ctx: RouterContext) {
    let {
      request: {
        body: { data },
      },
      params: { encodedCardURL: url },
    } = ctx;

    let cardId = this.realmManager.parseCardURL(url);
    let card = await this.cards.as(INSECURE_CONTEXT).updateData({ ...cardId, data: data.attributes }, 'isolated');
    ctx.body = serializeCardPayloadForFormat(card);
    ctx.status = 200;
  }

  private async deleteCard(ctx: RouterContext) {
    let {
      params: { encodedCardURL: url },
    } = ctx;

    let cardId = this.realmManager.parseCardURL(url);
    await this.cards.as(INSECURE_CONTEXT).delete(cardId);

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

    let card = await this.cards.as(INSECURE_CONTEXT).loadData(url, 'isolated');
    ctx.body = serializeCardPayloadForFormat(card);
  }

  private async getSource(ctx: RouterContext) {
    let {
      params: { encodedCardURL: url },
      query,
    } = ctx;

    let card = await this.cards.as(INSECURE_CONTEXT).load(url);
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
        let { compiled } = await this.cards.as(INSECURE_CONTEXT).load(this.config.routeCard);
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
    koaRouter.post(`/cards/:realmURL/:parentCardURL`, parseBody, this.createCardFromData);
    koaRouter.get(`/cards/`, this.queryCards);
    koaRouter.get(`/cards/:encodedCardURL`, this.getCard);
    koaRouter.patch(`/cards/:encodedCardURL`, parseBody, this.updateCardData);
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
