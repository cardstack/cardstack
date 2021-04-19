import { ENVIRONMENTS, ServerKoa } from '../interfaces';
import Builder from '../builder';
import { ServerOptions } from '../interfaces';
import isEqual from 'lodash/isEqual';

function validatePackageJson(cardCacheDir: string): void {
  let pkg;
  try {
    pkg = require(`${cardCacheDir}/package.json`);
  } catch (error) {
    throw new Error('package.json is required in cardCacheDir');
  }

  let e = pkg.exports;
  if (
    (!e['.'] || !isEqual(Object.keys(e['.']), ENVIRONMENTS)) &&
    (!e['./*'] || !isEqual(Object.keys(e['./*']), ENVIRONMENTS))
  ) {
    throw new Error(
      'package.json of cardCacheDir does not have properly configured exports'
    );
  }
}

export function setupCardBuilding(
  app: ServerKoa,
  options: { realms: ServerOptions['realms']; cardCacheDir: string }
) {
  let { realms, cardCacheDir } = options;

  validatePackageJson(cardCacheDir);

  // Make sure there is always a line ending on the realm.directory
  realms = realms.map((realm) => ({
    url: realm.url,
    directory: realm.directory.replace(/\/$/, '') + '/',
  }));

  app.context.builder = new Builder({ realms, cardCacheDir });
}
