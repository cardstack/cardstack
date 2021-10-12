import { HubServerConfig } from '../../interfaces';
import Mocha from 'mocha';
import { HubServer } from '../../main';
import CardCache from '../../services/card-cache';
import { Registry } from './../../di/dependency-injection';
import { TestCardCacheConfig, ProjectTestRealm, resolveCard } from './cards';
import supertest from 'supertest';

export function setupServer(mochaContext: Mocha.Suite, serverConfig: HubServerConfig = {}) {
  let server: HubServer, cardCache: CardCache, cardCacheConfig: TestCardCacheConfig;

  async function createRealm(name: string): Promise<ProjectTestRealm> {
    return (await server.container.lookup('realm-manager')).createRealm({ url: name }, ProjectTestRealm);
  }

  mochaContext.beforeEach(async function () {
    let originalCallback = serverConfig.registryCallback;
    let registryCallback = function (registry: Registry) {
      if (process.env.COMPILER) {
        registry.register('card-cache-config', TestCardCacheConfig);
      }

      originalCallback && originalCallback(registry);
    };
    serverConfig.registryCallback = registryCallback;

    server = await HubServer.create(serverConfig);

    if (process.env.COMPILER) {
      cardCache = await server.container.lookup('card-cache');
      cardCacheConfig = (await server.container.lookup('card-cache-config')) as TestCardCacheConfig;
    }
  });

  mochaContext.afterEach(async function () {
    await server.teardown();
  });

  return {
    getServer(): HubServer {
      return server;
    },
    request() {
      return supertest(server.app.callback());
    },
    createRealm,
    getCardCache(): CardCache {
      return cardCache;
    },
    resolveCard(module: string): string {
      return resolveCard(cardCacheConfig.root, module);
    },
  };
}
