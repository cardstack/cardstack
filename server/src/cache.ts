import { CompiledCard } from '@cardstack/core/src/interfaces';
import { encodeCardURL } from '@cardstack/core/src/utils';
import { Environment, NODE, ENVIRONMENTS } from './interfaces';
import {
  writeFileSync,
  readJSONSync,
  existsSync,
  mkdirpSync,
  ensureSymlinkSync,
} from 'fs-extra';
import { join, dirname } from 'path';

export class CardCache {
  constructor(private dir: string, private pkgName: string) {}

  private getLocation(
    env: Environment | 'assets',
    cardURL: string,
    localFile: string
  ): string {
    return join(this.dir, env, encodeCardURL(cardURL), localFile);
  }

  private moduleURL(cardURL: string, localFile: string): string {
    let encodedCardURL = encodeCardURL(cardURL);

    return join(this.pkgName, encodedCardURL, localFile);
  }

  setModule(
    env: Environment,
    cardURL: string,
    localFile: string,
    source: string
  ) {
    let fsLocation = this.getLocation(env, cardURL, localFile);
    this.writeFile(fsLocation, source);
    return this.moduleURL(cardURL, localFile);
  }

  writeAsset(cardURL: string, filename: string, source: string) {
    let assetPath = this.getLocation('assets', cardURL, filename);
    this.writeFile(assetPath, source);

    for (const env of ENVIRONMENTS) {
      ensureSymlinkSync(assetPath, this.getLocation(env, cardURL, filename));
    }
  }

  private writeFile(fsLocation: string, source: string): void {
    mkdirpSync(dirname(fsLocation));
    writeFileSync(fsLocation, source);
  }

  setCard(cardURL: string, source: CompiledCard) {
    this.setModule(
      NODE,
      cardURL,
      'compiled.json',
      JSON.stringify(source, null, 2)
    );
  }

  getCard(cardURL: string, env: Environment = NODE): CompiledCard | undefined {
    let loc = this.getLocation(env, encodeCardURL(cardURL), 'compiled.json');
    if (existsSync(loc)) {
      return readJSONSync(loc);
    }
    return;
  }
}
