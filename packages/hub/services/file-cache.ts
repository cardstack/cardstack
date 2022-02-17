import { encodeCardURL } from '@cardstack/core/src/utils';
import { Environment, ENVIRONMENTS } from '../interfaces';
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirpSync,
  ensureSymlinkSync,
  removeSync,
  pathExistsSync,
  ensureDirSync,
  outputJSONSync,
} from 'fs-extra';
import { join, dirname } from 'path';
import { inject, injectionReady } from '@cardstack/di';
import isEqual from 'lodash/isEqual';
import { Client } from 'pg';
import vm from 'vm';
import fetch from 'node-fetch';

declare global {
  const __non_webpack_require__: any;
}

export const MINIMAL_PACKAGE = {
  name: '@cardstack/compiled',
  exports: {
    './package.json': {
      default: './package.json',
    },
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
const EXPORTS_PATHS = ['.', './*'];
const EXPORTS_ENVIRONMENTS = ['browser', 'default'];
function hasValidExports(pkg: any): boolean {
  return EXPORTS_PATHS.every((key) => {
    return pkg[key] && isEqual(Object.keys(pkg[key]), EXPORTS_ENVIRONMENTS);
  });
}

function setupCacheDir(cardCacheDir: string): void {
  ensureDirSync(cardCacheDir);

  let pkg;
  try {
    pkg = __non_webpack_require__(`${cardCacheDir}/package.json`);
  } catch (error) {
    createMinimalPackageJSON(cardCacheDir);
    pkg = MINIMAL_PACKAGE;
  }

  if (!hasValidExports(pkg.exports)) {
    throw new Error('package.json of cardCacheDir does not have properly configured exports');
  }
}

import logger from '@cardstack/logger';
import { service } from '@cardstack/hub/services';
const log = logger('hub/file-cache');

export default class FileCache {
  config = service('file-cache-config', { as: 'config' });
  databaseManager = inject('database-manager', { as: 'databaseManager' });
  client!: Client;

  get dir() {
    return this.config.cacheDirectory;
  }

  get pkgName() {
    return this.config.packageName;
  }

  async ready() {
    await injectionReady(this, 'file-cache-config');
    setupCacheDir(this.dir);
    await injectionReady(this, 'database-manager');
    this.client = await this.databaseManager.getClient();
  }

  private getCardLocation(env: Environment | 'assets', cardURL: string): string {
    return join(this.dir, env, encodeCardURL(cardURL));
  }

  private getFileLocation(env: Environment | 'assets', cardURL: string, localFile: string): string {
    return join(this.getCardLocation(env, cardURL), localFile);
  }

  private writeFile(fsLocation: string, source: string): void {
    log.trace('writing file: %s', fsLocation);
    mkdirpSync(dirname(fsLocation));
    writeFileSync(fsLocation, source);
  }

  private readFile(fsLocation: string): string | undefined {
    if (existsSync(fsLocation)) {
      return readFileSync(fsLocation, { encoding: 'utf-8' });
    }

    return;
  }

  writeAsset(cardURL: string, filename: string, source: string): string {
    let assetPath = this.getFileLocation('assets', cardURL, filename);
    this.writeFile(assetPath, source);

    for (const env of ENVIRONMENTS) {
      ensureSymlinkSync(assetPath, this.getFileLocation(env, cardURL, filename));
    }
    return assetPath;
  }

  getAsset(cardURL: string, filename: string): string | undefined {
    return this.readFile(this.getFileLocation('assets', cardURL, filename));
  }

  entryExists(env: Environment | 'assets', cardURL: string, localFile: string): boolean {
    return pathExistsSync(this.getFileLocation(env, cardURL, localFile));
  }

  private moduleURL(cardURL: string, localFile: string): string {
    let encodedCardURL = encodeCardURL(cardURL);

    return join(this.pkgName, encodedCardURL, localFile);
  }

  setModule(env: Environment, cardURL: string, localFile: string, source: string) {
    let fsLocation = this.getFileLocation(env, cardURL, localFile);
    this.writeFile(fsLocation, source);
    return this.moduleURL(cardURL, localFile);
  }

  resolveModule(moduleURL: string, env: Environment = 'node'): string {
    return join(this.dir, env, moduleURL.replace(this.pkgName + '', ''));
  }

  getModule(moduleURL: string, env: Environment = 'node'): string | undefined {
    return this.readFile(this.resolveModule(moduleURL, env));
  }

  loadModule(moduleIdentifier: string): any {
    log.trace(`loadModule(${moduleIdentifier})`);

    if (moduleIdentifier.startsWith('@cardstack/compiled/')) {
      let code = this.getModule(moduleIdentifier);
      if (!code) {
        throw new Error(`unable to find code for ${moduleIdentifier}`);
      }
      let context = {
        exports: {},
        require: (specifier: string) => this.loadModule(specifier),

        // we have to white list globals that we want available to our cards
        setTimeout,
        fetch,
      };
      vm.createContext(context);
      vm.runInContext(code, context, { filename: this.resolveModule(moduleIdentifier) });
      return context.exports;
    }

    if (moduleIdentifier.startsWith('@cardstack/core/src/utils/')) {
      moduleIdentifier = moduleIdentifier.replace('@cardstack/core/src/utils/', '');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(`@cardstack/core/src/utils/${moduleIdentifier}`);
    }
    if (moduleIdentifier.startsWith('@cardstack/core/')) {
      moduleIdentifier = moduleIdentifier.replace('@cardstack/core/src/', '');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(`@cardstack/core/src/${moduleIdentifier}`);
    }

    throw new Error(`don't know how to loadModule ${moduleIdentifier}`);
  }

  deleteCardModules(cardURL: string): void {
    for (const env of ENVIRONMENTS) {
      let loc = this.getCardLocation(env, cardURL);

      if (!existsSync(loc)) {
        continue;
      }
      log.trace(`deleting`, loc);
      removeSync(loc);
    }
  }

  teardown(): void {
    log.debug('Cleaning Cache dir: ' + this.dir);
    for (let subDir of ENVIRONMENTS) {
      removeSync(join(this.dir, subDir));
    }
    removeSync(join(this.dir, 'assets'));
  }
}

declare module '@cardstack/hub/services' {
  interface HubServices {
    'file-cache': FileCache;
  }
}
