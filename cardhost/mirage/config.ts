import DbCollection from 'miragejs/db-collection';
import {
  Format,
  RawCard,
  FORMATS,
  cardJSONReponse,
} from '@cardstack/core/src/interfaces';

import type {
  Response as ResponseType,
  Request as RequestType,
} from 'miragejs';
import type { Server } from 'miragejs/server';

// @ts-ignore
import { Response } from 'ember-cli-mirage';

import Builder, { Cache } from 'cardhost/lib/builder';
import { getContext } from '@ember/test-helpers';
import { Memoize } from 'typescript-memoize';

import type { TestContext } from 'ember-test-helpers';
import { encodeCardURL } from '@cardstack/core/src/utils';

type CardParams = { type: 'raw' } | { format: Format; type?: 'compiled' };

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

/**
 * Mirage Routes
 */
export default function (this: Server): void {
  this.get(`/cards/:encodedCardURL`, returnCard);
  this.patch(`/cards/:encodedCardURL`, updateCard);
  this.get('/cardFor/:pathname', returnCardForRoute);
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

async function updateCard(_schema: any, request: RequestType) {
  let cardServer = FakeCardServer.current();
  let cardURL = request.params.encodedCardURL;

  return cardServer.updateCardData(
    cardURL,
    JSON.parse(request.requestBody).data.attributes
  );
}

async function returnCardForRoute(_schema: any, request: RequestType) {
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
}

class MirageCache implements Cache<RawCard> {
  // TODO: How do I make the DbCollection aware of the cardModel?
  constructor(private db: DbCollection) {}
  get(url: string): RawCard | undefined {
    let cardModel = this.db.find(encodeCardURL(url));
    if (cardModel) {
      return cardModel.raw;
    }
    return;
  }
  set(url: string, payload: RawCard): void {
    this.db.insert({ id: encodeCardURL(url), raw: payload });
  }
  update(url: string, payload: RawCard): void {
    this.db.update(encodeCardURL(url), {
      id: encodeCardURL(url),
      raw: payload,
    });
  }
  delete(url: string): void {
    this.db.remove(encodeCardURL(url));
  }
}

class FakeCardServer {
  static cardServers = new WeakMap<object, FakeCardServer>();

  routingCard?: string;

  constructor(private db: DbCollection) {}

  static current(): FakeCardServer {
    let testContext = getContext() as TestContext;
    if (!testContext) {
      throw new Error(`FakeCardServer only works in tests`);
    }

    let server = this.cardServers.get(testContext);
    if (!server) {
      server = new this(testContext.server.db.cards);
      server.routingCard = testContext.routingCard;
      this.cardServers.set(testContext, server);
    }

    return server;
  }

  @Memoize()
  get builder(): Builder {
    return new Builder({ rawCardCache: new MirageCache(this.db) });
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
        },
      },
    };
  }

  async updateCardData(url: string, payload: any): Promise<cardJSONReponse> {
    let format: Format = 'isolated'; // TODO: Assuming isolated, maybe not?
    let card = await FakeCardServer.current().builder.updateCardData(
      url,
      payload
    );

    // TODO: Should server/src/utils/serialization be moved to core and reused here?
    return {
      data: {
        id: url,
        type: 'card',
        attributes: card.data,
        meta: {
          componentModule: card[format].moduleName,
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
