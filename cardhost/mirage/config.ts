import { cardJSONReponse } from '@cardstack/server/src/interfaces';
import { Format, RawCard, FORMATS } from '@cardstack/core/src/interfaces';
import type {
  Response as ResponseType,
  Request as RequestType,
} from 'miragejs';
import type { Server } from 'miragejs/server';

// @ts-ignore
import { Response } from 'ember-cli-mirage';

import Builder from 'cardhost/lib/builder';
import { getContext } from '@ember/test-helpers';
import { Memoize } from 'typescript-memoize';

import type { TestContext } from 'ember-test-helpers';

// const REALM = 'https://cardstack.com/mirage';

type CardParams = { type: 'raw' } | { format: Format; type?: 'compiled' };

class FakeCardServer {
  static cardServers = new WeakMap<object, FakeCardServer>();

  routingCard?: string;

  static current(): FakeCardServer {
    let testContext = getContext() as TestContext;
    if (!testContext) {
      throw new Error(`FakeCardServer only works in tests`);
    }
    let server = this.cardServers.get(testContext);
    if (!server) {
      server = new this();
      server.routingCard = testContext.routingCard;
      this.cardServers.set(testContext, server);
    }
    return server;
  }

  @Memoize()
  get builder(): Builder {
    return new Builder();
  }

  async respondWithCard(url: string, format: Format): Promise<cardJSONReponse> {
    let card = await FakeCardServer.current().builder.getCompiledCard(url);

    return {
      data: {
        id: url,
        type: 'card',
        attributes: card.data,
        meta: {
          componentModule: card[format].moduleName,
          deserializationMap: card[format].deserialize,
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

function assertValidQueryParams(
  queryParams: any
): asserts queryParams is CardParams {
  let { type, format } = queryParams;
  if (type && !['raw', 'compiled'].includes(type)) {
    throw new Error(`unsupported ?type=${type}`);
  }
  if (format && !FORMATS.includes(format)) {
    throw new Error(`unsupported ?format=${format}`);
  }
  if (type === 'compiled' && !format) {
    throw new Error(`format is required at the moment`);
  }
}

async function returnCard(schema: any, request: RequestType) {
  let cardServer = FakeCardServer.current();
  let params = request.queryParams;
  assertValidQueryParams(params);
  let cardURL = request.params.encodedCardURL;

  if (params.type === 'raw') {
    return cardServer.respondWithRawCard(schema, cardURL);
  }
  return cardServer.respondWithCard(cardURL, params.format);
}

export default function (this: Server): void {
  this.get(`/cards/:encodedCardURL`, returnCard);

  this.get('/cardFor/:pathname', async function (schema: any, request) {
    let cardServer = FakeCardServer.current();
    let { routingCard } = cardServer;
    if (!routingCard) {
      return new Response(
        404,
        {},
        { error: `Not Found: no routing card has been defined for this space` }
      );
    }
    let compiled = await cardServer.builder.getCompiledCard(routingCard);
    let Klass = window.require(compiled.schemaModule).default;
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
