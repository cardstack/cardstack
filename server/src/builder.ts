import walkSync from 'walk-sync';
import {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
  assertValidRawCard,
} from '@cardstack/core/src/interfaces';
import { RealmConfig } from './interfaces';
import { Compiler } from '@cardstack/core/src/compiler';
import {
  readFileSync,
  writeFileSync,
  readJSONSync,
  existsSync,
} from 'fs-extra';
import { join } from 'path';
import { NotFound } from './error';

class CardCache {
  constructor(private dir: string) {}

  private getLocation(moduleURL: string): string {
    let filename = encodeURIComponent(moduleURL);
    return join(this.dir, filename);
  }

  private moduleURL(cardURL: string, localFile: string): string {
    return new URL(localFile, cardURL.replace(/\/$/, '') + '/').href;
  }

  setModule(cardURL: string, localFile: string, source: string) {
    let url = this.moduleURL(cardURL, localFile);
    writeFileSync(this.getLocation(url), source);
    return url;
  }

  setCard(cardURL: string, source: CompiledCard) {
    this.setModule(cardURL, 'compiled.json', JSON.stringify(source, null, 2));
  }

  getCard(cardURL: string): CompiledCard | undefined {
    let loc = this.getLocation(this.moduleURL(cardURL, 'compiled.json'));
    if (existsSync(loc)) {
      return readJSONSync(loc);
    }
    return;
  }
}

export default class Builder implements BuilderInterface {
  private compiler = new Compiler({
    lookup: (url) => this.getCompiledCard(url),
    define: (...args) => this.defineModule(...args),
  });

  // private cache: Map<string, CompiledCard>;
  private realms: RealmConfig[];
  private cache: CardCache;

  constructor(params: { realms: RealmConfig[]; cardCacheDir: string }) {
    this.realms = params.realms;
    this.cache = new CardCache(params.cardCacheDir);
  }

  private async defineModule(
    cardURL: string,
    localModule: string,
    source: string
  ): Promise<string> {
    let url = this.cache.setModule(cardURL, localModule, source);
    return `@cardstack/compiled/${encodeURIComponent(url)}`;
  }

  private locateRealmDir(url: string): string {
    for (let realm of this.realms) {
      if (url.startsWith(realm.url)) {
        return join(realm.directory, url.replace(realm.url, ''));
      }
    }
    throw new NotFound(`${url} is not in a realm we know about`);
  }

  async getRawCard(url: string): Promise<RawCard> {
    let dir = this.locateRealmDir(url);
    let files: any = {};
    for (let file of walkSync(dir, {
      directories: false,
    })) {
      let fullPath = join(dir, file);
      files[file] = readFileSync(fullPath, 'utf8');
    }
    let cardJSON = files['card.json'];
    if (!cardJSON) {
      throw new Error(`${url} is missing card.json`);
    }
    delete files['card.json'];
    let card = JSON.parse(cardJSON);
    Object.assign(card, { files, url });
    assertValidRawCard(card);
    return card;
  }

  async getCompiledCard(url: string): Promise<CompiledCard> {
    let compiledCard = this.cache.getCard(url);

    if (compiledCard) {
      return compiledCard;
    }

    let rawCard = await this.getRawCard(url);
    compiledCard = await this.compiler.compile(rawCard);
    this.cache.setCard(url, compiledCard);

    return compiledCard;
  }

  async buildCard(url: string): Promise<void> {
    let rawCard = await this.getRawCard(url);
    let compiledCard = await this.compiler.compile(rawCard);
    this.cache.setCard(url, compiledCard);
  }
}
