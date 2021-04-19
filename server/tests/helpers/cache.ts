import tmp from 'tmp';
import { join } from 'path';
import { ensureDirSync, outputJSONSync } from 'fs-extra';

tmp.setGracefulCleanup();

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

export function setupCardCache(
  hooks: NestedHooks
): {
  resolveCard: (modulePath: string) => string;
  getCardCacheDir: () => string;
} {
  let tmpDir: string, cardCacheDir: string;

  function resolveCard(modulePath: string): string {
    return require.resolve(modulePath, { paths: [tmpDir] });
  }

  function getCardCacheDir(): string {
    return cardCacheDir;
  }

  hooks.beforeEach(function () {
    tmpDir = tmp.dirSync().name;
    cardCacheDir = join(tmpDir, 'node_modules', '@cardstack', 'compiled');
    ensureDirSync(cardCacheDir);
    outputJSONSync(join(cardCacheDir, 'package.json'), MINIMAL_PACKAGE);
  });

  return { resolveCard, getCardCacheDir };
}
