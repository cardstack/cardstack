import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
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
      // .use(logger())
      .use(cors({ origin: '*' }));

    setupCardBuilding(app, { realms, cardCacheDir });

    if (routeCard) {
      await setupCardRouting(app, { routeCard });
    }

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
    koaRouter.get(`/sources/:encordedCardURL`, unimpl);
    koaRouter.patch(`/sources/:encodedCardURL`, unimpl);
    koaRouter.delete(`/sources/:encodedCardURL`, unimpl);

    // card-based routing is a layer on top of the 'cards' section where you can
    // fetch card data indirectly.
    koaRouter.get('/cardFor/:pathname', respondWithCardForPath);

    app.use(koaRouter.routes());
    app.use(koaRouter.allowedMethods());

    return new this(app, options);
  }

  private watchers: sane.Watcher[] | undefined;

  private constructor(public app: Koa, private options: ServerOptions) {}

  async primeCache() {
    let {
      options: { cardCacheDir, realms },
      app: {
        context: { builder },
      },
    } = this;
    cleanCache(cardCacheDir);
    await primeCache(realms, builder);
  }

  async startWatching() {
    let {
      options: { realms },
      app: {
        context: { builder },
      },
    } = this;

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
