import type {
  Response as ResponseType,
  Request as RequestType,
} from 'miragejs';
import type { Server } from 'miragejs/server';

// @ts-ignore
import { Response } from 'ember-cli-mirage';

import Builder from 'cardhost/lib/builder';
import { Format, RawCard } from '@cardstack/core/src/interfaces';
import { getContext } from '@ember/test-helpers';
import { Memoize } from 'typescript-memoize';

// const REALM = 'https://cardstack.com/mirage';

type CardParams = { type: 'raw' } | { format: Format; type?: 'compiled' };

class FakeCardServer {
  static cardServers = new WeakMap<object, FakeCardServer>();

  static current(): FakeCardServer {
    let testContext = getContext();
    if (!testContext) {
      throw new Error(`FakeCardServer only works in tests`);
    }
    let server = this.cardServers.get(testContext);
    if (!server) {
      server = new this();
      this.cardServers.set(testContext, server);
    }
    return server;
  }

  @Memoize()
  get builder(): Builder {
    return new Builder();
    // return new Builder({
    //   realm: [
    //     {
    //       url: 'https://cardstack.com/base',
    //     },
    //     {
    //       url: 'https://mirage',
    //     },
    //   ],
    // });
  }

  async respondWithCard(url: string, format: Format) {
    let {
      model,
      moduleName,
    } = await FakeCardServer.current().builder.getBuiltCard(url, format);

    return {
      data: {
        id: url,
        attributes: model,
        meta: {
          componentModule: moduleName,
        },
      },
    };
  }

  respondWithRawCard(schema: any, url: string): RawCard | ResponseType {
    let rawCard = schema.cards.find(url);
    if (!rawCard) {
      return new Response(404, {}, { error: `Not Found: No card for '${url}` });
    }
    return rawCard;
  }
}

function cardParams(queryParams: RequestType['queryParams']): CardParams {
  let { type, format } = queryParams;
  if (type && !['raw', 'compiled'].includes(type)) {
    throw new Error(`unsupported ?type=${type}`);
  }
  if (format && !['isolated', 'embedded'].includes(format)) {
    throw new Error(`unsupported ?format=${format}`);
  }
  if (type === 'compiled' && !format) {
    throw new Error(`format is required at the moment`);
  }
  return (queryParams as unknown) as CardParams;
}

async function returnCard(schema: any, request: RequestType) {
  let cardServer = FakeCardServer.current();
  let params = cardParams(request.queryParams);
  let cardURL = request.params.encodedCardURL;

  if (params.type === 'raw') {
    return cardServer.respondWithRawCard(schema, cardURL);
  }
  return cardServer.respondWithCard(cardURL, params.format);
}

export default function (this: Server): void {
  this.get(`/cards/:encodedCardURL`, returnCard);

  this.get('/cardFor/:pathname', async function (schema: any, request) {
    let { routingCard } = schema.spaces.find('home');
    let cardServer = FakeCardServer.current();
    if (!routingCard) {
      return new Response(
        404,
        {},
        { error: `Not Found: no routing card has been defined for this space` }
      );
    }
    let compiled = await cardServer.builder.getCompiledCard(routingCard);
    let Klass = window.require(compiled.modelModule).default;
    let instance = new Klass();
    let cardURL = instance.routeTo('/' + request.params.pathname);
    if (!cardURL) {
      return new Response(
        404,
        {},
        {
          error: `Not Found: routing card ${routingCard} returned 404 for ${request.params.pathname}`,
        }
      );
    }
    return cardServer.respondWithCard(cardURL, 'isolated');
  });

  /*
    Shorthand cheatsheet:

    this.get('/posts');
    this.post('/posts');
    this.get('/posts/:id');
    this.put('/posts/:id'); // or this.patch
    this.del('/posts/:id');

    https://www.ember-cli-mirage.com/docs/route-handlers/shorthands
  */
}
