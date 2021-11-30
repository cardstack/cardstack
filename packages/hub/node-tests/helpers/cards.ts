import Mocha from 'mocha';
import tmp from 'tmp';
import { join } from 'path';
import { CardCacheConfig } from '../../services/card-cache-config';
import { contextFor, registry } from './server';
import CardServiceFactory, { CardService, INSECURE_CONTEXT } from '../../services/card-service';
import CardCache from '../../services/card-cache';
import { TEST_REALM } from '@cardstack/core/tests/helpers';
import { RealmConfig } from '@cardstack/core/src/interfaces';
import { BASE_REALM_CONFIG, DEMO_REALM_CONFIG } from '../../services/realms-config';

tmp.setGracefulCleanup();

export class TestCardCacheConfig extends CardCacheConfig {
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

export function resolveCard(root: string, modulePath: string): string {
  return require.resolve(modulePath, { paths: [root] });
}
/**
 *  Override default config objects on the container. Must be run before container is setup.
 */
export function configureCompiler(mochaContext: Mocha.Suite) {
  let testRealmDir: string;

  mochaContext.beforeEach(async function () {
    let reg = registry(this);

    if (process.env.COMPILER) {
      reg.register('card-cache-config', TestCardCacheConfig);

      testRealmDir = tmp.dirSync().name;
      reg.register(
        'realmsConfig',
        class TestRealmsConfig {
          realms: RealmConfig[] = [BASE_REALM_CONFIG, DEMO_REALM_CONFIG, { url: TEST_REALM, directory: testRealmDir }];
        }
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
  let cardCache: CardCache;
  let cardCacheConfig: TestCardCacheConfig;
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
    let { container } = contextFor(mochaContext);
    if (!container) {
      throw new Error('Make sure cardHelpers are run after setupHub. It needs a configured container');
    }
    currentCardService = await container.lookup('card-service');
    cardCacheConfig = (await container.lookup('card-cache-config')) as TestCardCacheConfig;
    cardCache = await container.lookup('card-cache');
  });

  mochaContext.afterEach(async function () {
    currentCardService = undefined;
  });

  return {
    cards: cardServiceProxy as CardService,
    getCardCache(): CardCache {
      return cardCache;
    },
    resolveCard(module: string): string {
      return resolveCard(cardCacheConfig.root, module);
    },
  };
}
