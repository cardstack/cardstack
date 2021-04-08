import walkSync from 'walk-sync';
import {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
  assertValidRawCard,
} from '@cardstack/core/src/interfaces';
import { RealmConfig } from './interfaces';
import { Compiler } from '@cardstack/core/src/compiler';
import fs from 'fs';
import { join } from 'path';
import { NotFound } from './error';

class CardCache {
  constructor(private dir: string) {}

  private getLocation(cardURL: string): string {
    let filename = encodeURIComponent(cardURL);

    return join(this.dir, filename);
  }

  setModule(moduleURL: string, source: string) {
    fs.writeFileSync(this.getLocation(moduleURL), source);
  }

  setCard(cardURL: string, source: CompiledCard) {
    fs.writeFileSync(
      this.getLocation(`${cardURL}/compiled.json`),
      JSON.stringify(source)
    );
  }

  getCard(cardURL: string): CompiledCard | undefined {
    let loc = this.getLocation(`${cardURL}/compiled.json`);
    if (fs.existsSync(loc)) {
      return require(loc);
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
    moduleURL: string,
    source: string
  ): Promise<string> {
    // TODO: This will not be runable by the app until the work done
    // in cardhost/lib/dynamic-card-transform. But that is ember-specific
    // so we have some thinking to do
    this.cache.setModule(moduleURL, source);
    return `@cardstack/compiled/${encodeURIComponent(moduleURL)}`;
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
      files[file] = fs.readFileSync(fullPath, 'utf8');
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
    // TODO: We need a way to clear the cache for things like tests before
    // this should be used without causing problems.
    // let compiledCard = this.cache.getCard(url);

    // if (compiledCard) {
    //   return compiledCard;
    // }

    let rawCard = await this.getRawCard(url);
    let compiledCard = await this.compiler.compile(rawCard);
    this.cache.setCard(url, compiledCard);

    return compiledCard;
  }
}
