import Koa from 'koa';
import Router from '@koa/router';
import Builder from './builder';
import { RealmConfig } from './interfaces';
import { Serializer } from 'jsonapi-serializer';

interface ServerOptions {
  realms: RealmConfig[];
  cardCacheDir: string;
}

export class Server {
  static async create(options: ServerOptions): Promise<Server> {
    let { realms, cardCacheDir } = options;

    let router = new Router();
    let app = new Koa();
    let builder = new Builder({ realms, cardCacheDir });

    // The card data layer
    router.get(`/cards/:encodedCardURL`, async (ctx) => {
      let format: 'isolated' | 'embedded' = 'isolated'; // todo: query param
      let url = decodeURIComponent(ctx.params.encodedCardURL);
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
    app.use(router.routes());
    app.use(router.allowedMethods());

    return new this(app, builder);
  }

  private constructor(public app: Koa, private builder: Builder) {}

}
