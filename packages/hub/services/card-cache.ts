import { CompiledCard } from '@cardstack/core/src/interfaces';
import { encodeCardURL } from '@cardstack/core/src/utils';
import { Environment, NODE, ENVIRONMENTS } from '../interfaces';
import {
  writeFileSync,
  readJSONSync,
  readFileSync,
  existsSync,
  mkdirpSync,
  ensureSymlinkSync,
  removeSync,
  pathExistsSync,
} from 'fs-extra';
import { join, dirname } from 'path';
import { inject } from '../di/dependency-injection';

export default class CardCache {
  config = inject('card-cache-config', { as: 'config' });

  get dir() {
    return this.config.cacheDirectory;
  }

  get pkgName() {
    return this.config.packageName;
  }

  private getCardLocation(env: Environment | 'assets', cardURL: string): string {
    return join(this.dir, env, encodeCardURL(cardURL));
  }

  private getFileLocation(env: Environment | 'assets', cardURL: string, localFile: string): string {
    return join(this.getCardLocation(env, cardURL), localFile);
  }

  private writeFile(fsLocation: string, source: string): void {
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

  setCard(cardURL: string, source: CompiledCard) {
    this.setModule(NODE, cardURL, 'compiled.json', JSON.stringify(source, null, 2));
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

  getModule(moduleURL: string, env: Environment = 'node'): string | undefined {
    return this.readFile(join(this.dir, env, moduleURL.replace(this.pkgName + '', '')));
  }

  getCard(cardURL: string, env: Environment = NODE): CompiledCard | undefined {
    let loc = this.getFileLocation(env, encodeCardURL(cardURL), 'compiled.json');

    if (existsSync(loc)) {
      return readJSONSync(loc);
    }

    return;
  }

  deleteCard(cardURL: string): void {
    for (const env of ENVIRONMENTS) {
      let loc = this.getCardLocation(env, cardURL);

      if (!existsSync(loc)) {
        continue;
      }

      removeSync(loc);
    }
  }

  cleanup(): void {
    removeSync(this.dir);
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'card-cache': CardCache;
  }
}
