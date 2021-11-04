import Mocha from 'mocha';
import { createRegistry, HubServer } from '../../main';
import CardCache from '../../services/card-cache';
import { Container, Registry } from '@cardstack/di';
import { TestCardCacheConfig, resolveCard } from './cards';
import supertest from 'supertest';
import { default as CardServiceFactory, CardService, INSECURE_CONTEXT } from '../../services/card-service';

import tmp from 'tmp';
tmp.setGracefulCleanup();

const REALM = 'https://my-realm/';

interface InternalContext {
  registry?: Registry;
}
let contextMap = new WeakMap<object, InternalContext>();
function contextFor(mocha: object): InternalContext {
  let internal = contextMap.get(mocha);
  if (!internal) {
    internal = {};
    contextMap.set(mocha, internal);
  }
  return internal;
}

export function registry(context: object): Registry {
  let internal = contextFor(context);
  if (!internal.registry) {
    internal.registry = createRegistry();
    internal.registry.register('card-cache-config', TestCardCacheConfig);
  }
  return internal.registry;
}

export function setupHub(mochaContext: Mocha.Suite) {
  let container: Container, server: HubServer, cardCache: CardCache, cardCacheConfig: TestCardCacheConfig;

  let currentCardService: CardServiceFactory | undefined;
  let cardServiceProxy = new Proxy(
    {},
    {
      get(_target, propertyName) {
        if (!process.env.COMPILER) {
          throw new Error(`compiler flag not active`);
        }
        if (!currentCardService) {
          throw new Error(`tried to use cardService outside of an active test`);
        }
        return (currentCardService.as(INSECURE_CONTEXT) as any)[propertyName];
      },
    }
  );

  mochaContext.beforeEach(async function () {
    container = new Container(registry(this));

    if (process.env.COMPILER) {
      cardCache = await container.lookup('card-cache');
      cardCacheConfig = (await container.lookup('card-cache-config')) as TestCardCacheConfig;
      (await container.lookup('realm-manager')).createRealm({
        url: REALM,
        directory: tmp.dirSync().name,
      });
      currentCardService = await container.lookup('card-service');
    }
    server = await container.lookup('hubServer');

    // TODO: by the time we return, the cards in all the configured realms (base, have been indexed
    // await initialIndexing();
  });

  mochaContext.afterEach(async function () {
    await container.teardown();
    currentCardService = undefined;
  });

  return {
    getContainer() {
      return container;
    },
    cards: cardServiceProxy as CardService,
    request() {
      return supertest(server.app.callback());
    },
    getCardCache(): CardCache {
      return cardCache;
    },
    resolveCard(module: string): string {
      return resolveCard(cardCacheConfig.root, module);
    },
    get realm() {
      return REALM;
    },
  };
}
