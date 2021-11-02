import { HubServerConfig } from '../../interfaces';
import Mocha from 'mocha';
import { HubServer } from '../../main';
import CardCache from '../../services/card-cache';
import { Registry } from '@cardstack/di';
import { TestCardCacheConfig, ProjectTestRealm, resolveCard } from './cards';
import supertest from 'supertest';
import { INSECURE_CONTEXT } from '../../services/card-service';

export function setupServer(
  mochaContext: Mocha.Suite,
  config: {
    registryCallback?: HubServerConfig['registryCallback'];
    testRealm?: string;
  } = {}
) {
  let server: HubServer, cardCache: CardCache, cardCacheConfig: TestCardCacheConfig;

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
    }

    if (config.testRealm) {
      return (await server.container.lookup('realm-manager')).createRealm({ url: config.testRealm }, ProjectTestRealm);
    }
  });

  mochaContext.afterEach(async function () {
    await server.teardown();
  });

  return {
    getContainer() {
      return server.container;
    },
    async getCardService() {
      return (await server.container.lookup('card-service')).as(INSECURE_CONTEXT);
    },
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
  };
}
