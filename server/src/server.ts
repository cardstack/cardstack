import Koa from 'koa';
import Router from '@koa/router';
import logger from 'koa-logger';
import cors from '@koa/cors';
import Builder from './builder';
import { RealmConfig } from './interfaces';
import { Serializer } from 'jsonapi-serializer';
import walkSync from 'walk-sync';

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
      // TODO: get query param
      let format: 'isolated' | 'embedded' = 'isolated'; // todo: query param
      let url = ctx.params.encodedCardURL;

      try {
        let card = await builder.getCompiledCard(url);
        ctx.set('content-type', 'application/json');
        let cardSerializer = new Serializer('card', {
          attributes: card[format].usedFields,
          dataMeta: {
            componentModule: card[format].moduleName,
          },
        });

        ctx.body = cardSerializer.serialize(card.data);
      } catch (err) {
        if (err.status != null) {
          ctx.response.status = err.status;
          ctx.body = {
            errors: [
              {
                status: err.status,
                detail: err.message,
              },
            ],
          };
        } else {
          ctx.response.status = 500;
          ctx.body = {
            errors: [
              {
                status: 500,
                detail: 'An unexpected exception occured',
              },
            ],
          };
          console.error(err);
        }
      }
    });
    app.use(logger());
    app.use(cors({ origin: '*' }));
    app.use(router.routes());
    app.use(router.allowedMethods());

    return new this(app, builder, options);
  }

  private constructor(
    public app: Koa,
    private builder: Builder,
    private options: ServerOptions
  ) {}

  async start(port: number) {
    let promises = [];

    for (let realm of this.options.realms) {
      let cards = walkSync(realm.directory, { globs: ['**/card.json'] });
      for (let cardPath of cards) {
        let fullCardUrl = new URL(cardPath.replace('card.json', ''), realm.url)
          .href;
        promises.push(this.builder.getCompiledCard(fullCardUrl));
      }
    }

    await Promise.all(promises);
    // glob on card.json
    // for each card, call builder.getCompiledCard

    this.app.listen(port);
  }

  stopWatching() {}
}
