import tmp from 'tmp';
import { join } from 'path';
import { ensureDirSync, outputJSONSync } from 'fs-extra';
import Mocha from 'mocha';

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

export function createCardCacheDir() {
  let tmpDir = tmp.dirSync().name;
  let cardCacheDir = join(tmpDir, 'node_modules', '@cardstack', 'compiled');
  ensureDirSync(cardCacheDir);
  createMinimalPackageJSON(cardCacheDir);
  return { tmpDir, cardCacheDir };
}

export function createMinimalPackageJSON(cardCacheDir: string): void {
  outputJSONSync(join(cardCacheDir, 'package.json'), MINIMAL_PACKAGE);
}

export function setupCardCache(mochaContext: Mocha.Suite): {
  resolveCard: (modulePath: string) => string;
  getCardCacheDir: () => string;
} {
  let _tmpDir: string, _cardCacheDir: string;

  function resolveCard(modulePath: string): string {
    return require.resolve(modulePath, { paths: [_tmpDir] });
  }

  function getCardCacheDir(): string {
    return _cardCacheDir;
  }

  mochaContext.beforeEach(function () {
    let { tmpDir, cardCacheDir } = createCardCacheDir();
    createMinimalPackageJSON(cardCacheDir);
    _tmpDir = tmpDir;
    _cardCacheDir = cardCacheDir;
  });

  return { resolveCard, getCardCacheDir };
}
