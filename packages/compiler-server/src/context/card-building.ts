import Koa from 'koa';
import isEqual from 'lodash/isEqual';

import Builder from '../builder';
import { CardStackContext } from '../interfaces';
import RealmManager from '../realm-manager';

const EXPORTS_PATHS = ['.', './*'];
const EXPORTS_ENVIRONMENTS = ['browser', 'default'];

function hasValidExports(pkg: any): boolean {
  return EXPORTS_PATHS.every((key) => {
    return pkg[key] && isEqual(Object.keys(pkg[key]), EXPORTS_ENVIRONMENTS);
  });
}

function validateCacheDirSetup(cardCacheDir: string): void {
  let pkg;
  try {
    pkg = require(`${cardCacheDir}/package.json`);
  } catch (error) {
    throw new Error('package.json is required in cardCacheDir');
  }

  if (!hasValidExports(pkg.exports)) {
    throw new Error('package.json of cardCacheDir does not have properly configured exports');
  }
}

export function setupCardBuilding(
  app: Koa<any, CardStackContext>,
  options: {
    realms: RealmManager;
    cardCacheDir: string;
  }
) {
  let { realms, cardCacheDir } = options;

  validateCacheDirSetup(cardCacheDir);

  app.context.requireCard = function (path: string): any {
    const module = require.resolve(path, {
      paths: [cardCacheDir],
    });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(module);
  };

  app.context.realms = realms;

  app.context.builder = new Builder({
    realms,
    cardCacheDir,
    pkgName: '@cardstack/compiled',
  });
}
