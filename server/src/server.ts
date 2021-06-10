import Koa from 'koa';
import Router from '@koa/router';
import logger from 'koa-logger';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import sane from 'sane';

import { cleanCache, primeCache, setupWatchers } from './watcher';
import { errorMiddleware } from './middleware/errors';
import { CardStackContext, ServerOptions } from './interfaces';
import { setupCardBuilding } from './context/card-building';
import { setupCardRouting } from './context/card-routing';

import {
  createDataCard,
  deleteCard,
  getCard,
  respondWithCardForPath,
  updateCard,
} from './routes/card-routes';
import { assertCardExists } from './middleware/card-utils';

function unimpl() {
  throw new Error('unimplemented');
}

export class Server {
  static async create(options: ServerOptions): Promise<Server> {
    let { realms, cardCacheDir, routeCard } = options;

    let koaRouter = new Router<{}, CardStackContext>();

    // NOTE: PR defining how to do types on Koa context and application:
    // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/31704
    let app = new Koa<{}, CardStackContext>()
      .use(errorMiddleware)
      .use(bodyParser())
      .use(logger())
      .use(cors({ origin: '*' }));

    app.context.builder = setupCardBuilding({ realms, cardCacheDir });

    if (routeCard) {
      await setupCardRouting(app, { routeCard, cardCacheDir });
    }

    // the 'cards' section of the API deals in card data. The shape of the data
    // on these endpoints is determined by each card's own schema.
    koaRouter.post(`/cards/:encodedCardURL`, createDataCard);
    koaRouter.get(`/cards/:encodedCardURL`, assertCardExists, getCard);
    koaRouter.patch(`/cards/:encodedCardURL`, assertCardExists, updateCard);
    koaRouter.delete(`/cards/:encodedCardURL`, assertCardExists, deleteCard);

    // the 'sources' section of the API deals in RawCards. It's where you can do
    // CRUD operations on the sources themselves. It's a superset of what you
    // can do via the 'cards' section.
    koaRouter.get(`/sources/new`, assertCardExists, unimpl);
    koaRouter.post(`/sources/:encodedCardURL`, unimpl);
    koaRouter.patch(`/sources/:encodedCardURL`, assertCardExists, unimpl);
    koaRouter.delete(`/sources/:encodedCardURL`, assertCardExists, unimpl);

    // card-based routing is a layer on top of the 'cards' section where you can
    // fetch card data indirectly.
    koaRouter.get('/cardFor/:pathname', respondWithCardForPath);

    app.use(koaRouter.routes());
    app.use(koaRouter.allowedMethods());

    return new this(app, options);
  }

  private watchers: sane.Watcher[] | undefined;

  private constructor(public app: Koa, private options: ServerOptions) {}

  async startWatching() {
    let {
      options: { cardCacheDir, realms },
      app: {
        context: { builder },
      },
    } = this;

    cleanCache(cardCacheDir);
    await primeCache(realms, builder);
    this.watchers = setupWatchers(realms, builder);
  }

  stopWatching() {
    if (this.watchers) {
      for (let watcher of this.watchers) {
        watcher.close();
      }
    }
  }
}
