import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import sane from 'sane';

import { cleanCache, primeCache, setupWatchers } from './watcher';
import { errorMiddleware } from './middleware/errors';
import { CardStackContext, ServerOptions } from './interfaces';
import { setupCardBuilding } from './context/card-building';
import { cardRoutes } from './routes/card-routes';

export class Server {
  static async create(options: ServerOptions): Promise<Server> {
    let { realms, cardCacheDir, routeCard } = options;

    // NOTE: PR defining how to do types on Koa context and application:
    // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/31704
    let app = new Koa<{}, CardStackContext>()
      .use(errorMiddleware)
      .use(bodyParser())
      // .use(logger())
      .use(cors({ origin: '*' }));

    setupCardBuilding(app, { realms, cardCacheDir });

    let router = await cardRoutes(app.context, routeCard);
    app.use(router.routes());
    app.use(router.allowedMethods());

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
