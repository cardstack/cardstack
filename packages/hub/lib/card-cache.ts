import { CompiledCard } from '@cardstack/core/src/interfaces';
import { encodeCardURL } from '@cardstack/core/src/utils';
import { Environment, NODE, ENVIRONMENTS } from '../interfaces';
import { writeFileSync, readJSONSync, existsSync, mkdirpSync, ensureSymlinkSync, removeSync } from 'fs-extra';
import { join, dirname } from 'path';

export default class CardCache {
  constructor(private dir: string, private pkgName: string) {}

  private getCardLocation(env: Environment | 'assets', cardURL: string): string {
    return join(this.dir, env, encodeCardURL(cardURL));
  }

  private getFileLocation(env: Environment | 'assets', cardURL: string, localFile: string): string {
    return join(this.getCardLocation(env, cardURL), localFile);
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

  writeAsset(cardURL: string, filename: string, source: string): string {
    let assetPath = this.getFileLocation('assets', cardURL, filename);
    this.writeFile(assetPath, source);

    for (const env of ENVIRONMENTS) {
      ensureSymlinkSync(assetPath, this.getFileLocation(env, cardURL, filename));
    }
    return assetPath;
  }

  private writeFile(fsLocation: string, source: string): void {
    mkdirpSync(dirname(fsLocation));
    writeFileSync(fsLocation, source);
  }

  setCard(cardURL: string, source: CompiledCard) {
    this.setModule(NODE, cardURL, 'compiled.json', JSON.stringify(source, null, 2));
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
}
