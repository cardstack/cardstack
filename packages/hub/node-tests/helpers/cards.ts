import { Project } from 'scenario-tester';
import Mocha from 'mocha';
import tmp from 'tmp';
import { join } from 'path';
import { ensureDirSync, outputJSONSync } from 'fs-extra';

import { RawCard, RealmConfig } from '@cardstack/core/src/interfaces';
import { wireItUp } from '../../main';
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

export function setupCardBuilding(mochaContext: Mocha.Suite) {
  let realms: RealmManager, builder: CardBuilder;
  let cardCache: CardCache, cardCacheConfig: TestCardCacheConfig;

  function resolveCard(modulePath: string): string {
    return require.resolve(modulePath, { paths: [cardCacheConfig.root] });
  }

  function createRealm(name: string): ProjectTestRealm {
    return realms.createRealm({ url: name }, ProjectTestRealm);
  }

  mochaContext.beforeEach(async function () {
    let container = wireItUp((registry: Registry) => {
      registry.register('card-cache-config', TestCardCacheConfig);
    });

    let cardCacheConfig = await container.lookup('card-cache-config');
    ensureDirSync(cardCacheConfig.cacheDirectory);

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
    resolveCard,
    createRealm,
  };
}

export const MINIMAL_PACKAGE = {
  name: '@cardstack/compiled',
  exports: {
    '.': {
      browser: './browser',
      default: './node',
    },
    './*': {
      browser: './browser/*',
      default: './node/*',
    },
  },
};

export function createMinimalPackageJSON(cardCacheDir: string): void {
  outputJSONSync(join(cardCacheDir, 'package.json'), MINIMAL_PACKAGE);
}
