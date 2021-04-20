import Koa from 'koa';
import Router from '@koa/router';
import logger from 'koa-logger';
import cors from '@koa/cors';
import sane from 'sane';

import { cleanCache, primeCache, setupWatchers } from './watcher';
import { errorMiddleware } from './middleware/error';
import { ServerOptions } from './interfaces';
import { setupCardBuilding } from './context/card-building';
import { setupCardRouting } from './context/card-routing';
import { respondWithCard } from './routes/card-route';

export class Server {
  static async create(options: ServerOptions): Promise<Server> {
    let { realms, cardCacheDir, routeCard } = options;
    let koaRouter = new Router();
    // NOTE: PR defining how to do types on Koa context and application:
    // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/31704
    let app = new Koa<{}, {}>()
      .use(errorMiddleware)
      .use(logger())
      .use(cors({ origin: '*' }));

    setupCardBuilding(app, { realms, cardCacheDir });

    if (routeCard) {
      await setupCardRouting(app, koaRouter, { routeCard, cardCacheDir });
    }

    koaRouter.get(`/cards/:encodedCardURL`, respondWithCard);

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
