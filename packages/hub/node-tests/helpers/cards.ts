import Mocha from 'mocha';
import tmp from 'tmp';
import { join } from 'path';
import FileCacheConfig from '../../services/file-cache-config';
import { contextFor, registry, setupHub } from './server';
import { CardService, INSECURE_CONTEXT } from '../../services/card-service';
import FileCache from '../../services/file-cache';
import { TEST_REALM } from '@cardstack/core/tests/helpers';
import { RealmConfig } from '@cardstack/core/src/interfaces';
import { BASE_REALM_CONFIG } from '../../services/realms-config';

tmp.setGracefulCleanup();

export class TestFileCacheConfig extends FileCacheConfig {
  tmp = tmp.dirSync();

  get root() {
    return this.tmp.name;
  }

  get cacheDirectory() {
    return join(this.root, 'node_modules', this.packageName);
  }
}

export function resolveCard(root: string, modulePath: string): string {
  return __non_webpack_require__.resolve(modulePath, { paths: [root] });
}

export function configureHubWithCompiler(mochaContext: Mocha.Suite) {
  let { realmURL, getRealmDir } = configureCompiler(mochaContext);
  let { request, getContainer } = setupHub(mochaContext);
  let { cards, resolveCard, getFileCache } = cardHelpers(mochaContext);
  return {
    realmURL,
    getRealmDir,
    request,
    getContainer,
    cards,
    resolveCard,
    getFileCache,
  };
}

/**
 *  Override default config objects on the container. Must be run before container is setup.
 */
export function configureCompiler(mochaContext: Mocha.Suite) {
  let testRealmDir: string;

  mochaContext.beforeEach(async function () {
    let reg = registry(this);

    if (process.env.COMPILER) {
      reg.register('file-cache-config', TestFileCacheConfig, { type: 'service' });

      testRealmDir = tmp.dirSync().name;
      reg.register(
        'realmsConfig',
        class TestRealmsConfig {
          realms: RealmConfig[] = [BASE_REALM_CONFIG, { url: TEST_REALM, directory: testRealmDir }];
        },
        { type: 'service' }
      );
    }
  });

  return {
    get realmURL() {
      return TEST_REALM;
    },
    getRealmDir(): string {
      return testRealmDir;
    },
  };
}

/**
 * Access to regularly used test helpers for cards. Must be run after container is instatiated.
 */
export function cardHelpers(mochaContext: Mocha.Suite) {
  let fileCache: FileCache;
  let fileCacheConfig: TestFileCacheConfig;
  let currentCardService: CardService | undefined;
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
        return (currentCardService as any)[propertyName].bind(currentCardService);
      },
    }
  );

  mochaContext.beforeEach(async function () {
    let { container } = contextFor(mochaContext);
    if (!container) {
      throw new Error('Make sure cardHelpers are run after setupHub. It needs a configured container');
    }
    currentCardService = await (await container.lookup('card-service', { type: 'service' })).as(INSECURE_CONTEXT);
    fileCacheConfig = (await container.lookup('file-cache-config', { type: 'service' })) as TestFileCacheConfig;
    fileCache = await container.lookup('file-cache', { type: 'service' });

    let si = await container.lookup('searchIndex', { type: 'service' });
    await si.indexAllRealms();
  });

  mochaContext.afterEach(async function () {
    currentCardService = undefined;
  });

  return {
    cards: cardServiceProxy as CardService,
    getFileCache(): FileCache {
      return fileCache;
    },
    resolveCard(module: string): string {
      return resolveCard(fileCacheConfig.root, module);
    },
  };
}
