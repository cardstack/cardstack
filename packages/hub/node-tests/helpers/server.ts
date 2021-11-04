import { HubServerConfig } from '../../interfaces';
import Mocha from 'mocha';
import { HubServer } from '../../main';
import CardCache from '../../services/card-cache';
import { Registry } from '@cardstack/di';
import { TestCardCacheConfig, resolveCard } from './cards';
import supertest from 'supertest';
import { default as CardServiceFactory, CardService, INSECURE_CONTEXT } from '../../services/card-service';

import tmp from 'tmp';
tmp.setGracefulCleanup();

const REALM = 'https://my-realm/';

export function setupServer(
  mochaContext: Mocha.Suite,
  config: {
    registryCallback?: HubServerConfig['registryCallback'];
  } = {}
) {
  let server: HubServer, cardCache: CardCache, cardCacheConfig: TestCardCacheConfig;

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
    let registryCallback = function (registry: Registry) {
      if (process.env.COMPILER) {
        registry.register('card-cache-config', TestCardCacheConfig);
      }

      config.registryCallback && config.registryCallback(registry);
    };

    server = await HubServer.create({ registryCallback });

    if (process.env.COMPILER) {
      cardCache = await server.container.lookup('card-cache');
      cardCacheConfig = (await server.container.lookup('card-cache-config')) as TestCardCacheConfig;
      (await server.container.lookup('realm-manager')).createRealm({
        url: REALM,
        directory: tmp.dirSync().name,
      });
      currentCardService = await server.container.lookup('card-service');
    }

    // TODO: by the time we return, the cards in all the configured realms (base, have been indexed
    // await initialIndexing();
  });

  mochaContext.afterEach(async function () {
    await server.teardown();
    currentCardService = undefined;
  });

  return {
    getContainer() {
      return server.container;
    },
    cards: cardServiceProxy as CardService,
    getServer(): HubServer {
      return server;
    },
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
