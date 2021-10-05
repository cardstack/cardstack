import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import sane from 'sane';

import { setupWatchers } from './watcher';
import { CardStackContext, HubServerConfig } from '@cardstack/hub/interfaces';
import { setupCardBuilding } from './context/card-building';

export class HubServer {
  static async create(options: Partial<HubServerConfig>): Promise<HubServer> {
    let { realms, cardCacheDir } = options;

    // NOTE: PR defining how to do types on Koa context and application:
    // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/31704
    let app = new Koa<{}, CardStackContext>()
      .use(bodyParser())
      // .use(logger())
      .use(cors({ origin: '*' }));

    setupCardBuilding(app, { realms: realms!, cardCacheDir: cardCacheDir! });

    return new this(app, options as HubServerConfig);
  }

  private watchers: sane.Watcher[] | undefined;

  private constructor(public app: Koa<{}, any>, private options: HubServerConfig) {}

  async startWatching() {
    let {
      options: { realms },
      app: {
        context: { builder },
      },
    } = this;

    this.watchers = setupWatchers(realms!, builder);
  }

  stopWatching() {
    if (this.watchers) {
      for (let watcher of this.watchers) {
        watcher.close();
      }
    }
  }
}
