import { Project } from 'scenario-tester';
import Mocha from 'mocha';
import tmp from 'tmp';
import { join } from 'path';

import { RawCard, RealmConfig } from '@cardstack/core/src/interfaces';
import { HubServer, wireItUp } from '../../main';
import { CardCacheConfig } from '../../services/card-cache-config';
import CardBuilder from '../../services/card-builder';
import RealmManager from '../../services/realm-manager';
import FSRealm from '../../realms/fs-realm';

import type CardCache from '../../services/card-cache';
import type { Registry } from './../../di/dependency-injection';

tmp.setGracefulCleanup();

export const TEST_REALM = 'https://cardstack.local';

class TestCardCacheConfig extends CardCacheConfig {
  tmp = tmp.dirSync();

  get root() {
    return this.tmp.name;
  }

  get cacheDirectory() {
    return join(this.root, 'node_modules', this.packageName);
  }
  cleanup() {
    this.tmp.removeCallback();
  }
}

export class ProjectTestRealm extends FSRealm {
  project: Project;

  constructor(config: RealmConfig, manager: RealmManager) {
    let project = new Project(config.url);
    project.writeSync();
    config.directory = project.baseDir;
    super(config, manager);
    this.project = project;
  }

  addCard(cardID: string, files: Project['files']): void {
    files['card.json'] = JSON.stringify(files['card.json'], null, 2);
    this.project.files[cardID] = files;
    this.project.writeSync();
  }

  addRawCard(card: RawCard) {
    let c: any = Object.assign({}, card);
    let files = c.files || {};
    let url = c.url.replace(this.url + '/', '');
    delete c.files;
    delete c.url;
    files['card.json'] = c;

    this.addCard(url, files);
  }

  getFile(path: string) {
    return this.project.files[path];
  }
}

function resolveCard(root: string, modulePath: string): string {
  return require.resolve(modulePath, { paths: [root] });
}

export function setupCardBuilding(mochaContext: Mocha.Suite) {
  let realms: RealmManager, builder: CardBuilder;
  let cardCache: CardCache, cardCacheConfig: TestCardCacheConfig;

  function createRealm(name: string): ProjectTestRealm {
    return realms.createRealm({ url: name }, ProjectTestRealm);
  }

  mochaContext.beforeEach(async function () {
    let container = wireItUp((registry: Registry) => {
      registry.register('card-cache-config', TestCardCacheConfig);
    });

    cardCache = await container.lookup('card-cache');
    realms = await container.lookup('realm-manager');
    builder = await container.lookup('card-builder');

    // createMinimalPackageJSON(cache.cardCacheDir);
  });

  mochaContext.afterEach(function () {
    cardCache.cleanup();
  });

  return {
    getCardCache() {
      return cardCache;
    },
    getCardBuilder() {
      return builder;
    },
    getRealmManager() {
      return realms;
    },
    resolveCard(module: string) {
      return resolveCard(cardCacheConfig.root, module);
    },
    createRealm,
  };
}

export function setupCardServer(mochaContext: Mocha.Suite) {
  let server: HubServer, cardCache: CardCache, cardCacheConfig: TestCardCacheConfig;

  function createRealm(name: string): ProjectTestRealm {
    return server.builder.realmManager.createRealm({ url: name }, ProjectTestRealm);
  }

  mochaContext.beforeEach(async function () {
    server = await HubServer.create({
      registryCallback: (registry: Registry) => {
        registry.register('card-cache-config', TestCardCacheConfig);
      },
    });

    cardCache = await server.container.lookup('card-cache');
    cardCacheConfig = (await server.container.lookup('card-cache-config')) as TestCardCacheConfig;
  });

  mochaContext.afterEach(function () {
    server.teardown();
    cardCache.cleanup();
  });

  return {
    createRealm,
    getCardCache() {
      return cardCache;
    },
    getServer() {
      return server;
    },
    resolveCard(module: string) {
      return resolveCard(cardCacheConfig.root, module);
    },
    async setRoutingCard(cardURL: string) {
      return (await server.container.lookup('card-routes')).setRoutingCard(cardURL);
    },
  };
}
