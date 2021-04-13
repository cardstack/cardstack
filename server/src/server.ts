import Koa from 'koa';
import Router from '@koa/router';
import logger from 'koa-logger';
import cors from '@koa/cors';
import sane from 'sane';

import Builder from './builder';
import { RealmConfig } from './interfaces';
import { cardRoute } from './routes/card';
import { cleanCache, primeCache, setupWatchers } from './watcher';

interface ServerOptions {
  realms: RealmConfig[];
  cardCacheDir: string;
}

export class Server {
  static async create(options: ServerOptions): Promise<Server> {
    let { realms, cardCacheDir } = options;

    // Make sure there is always a line ending on the realm.directory
    realms = realms.map((realm) => ({
      url: realm.url,
      directory: realm.directory.replace(/\/$/, '') + '/',
    }));

    let router = new Router();
    let app = new Koa();
    let builder = new Builder({ realms, cardCacheDir });

    // The card data layer
    router.get(`/cards/:encodedCardURL`, async (ctx) => {
      cardRoute(ctx, builder);
    });

    app.use(logger());
    app.use(cors({ origin: '*' }));
    app.use(router.routes());
    app.use(router.allowedMethods());

    return new this(app, builder, options);
  }

  private watchers: sane.Watcher[] | undefined;

  private constructor(
    public app: Koa,
    private builder: Builder,
    private options: ServerOptions
  ) {}

  async startWatching() {
    let {
      builder,
      options: { cardCacheDir, realms },
    } = this;

    cleanCache(cardCacheDir);

    primeCache(realms, builder);

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
