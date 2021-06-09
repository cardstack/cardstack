import walkSync from 'walk-sync';
import {
  readFileSync,
  existsSync,
  removeSync,
  readJsonSync,
  writeJsonSync,
} from 'fs-extra';
import { join } from 'path';

import {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
  assertValidRawCard,
  RealmConfig,
} from '@cardstack/core/src/interfaces';
import { Compiler } from '@cardstack/core/src/compiler';

import { NotFound } from './middleware/errors';
import { transformSync } from '@babel/core';
import { NODE, BROWSER } from './interfaces';
import { CardCache } from './cache';
import { JS_TYPE } from '@cardstack/core/src/utils/content';

export default class Builder implements BuilderInterface {
  private compiler = new Compiler({
    builder: this,
    define: (...args) => this.define(...args),
  });

  // private cache: Map<string, CompiledCard>;
  private realms: RealmConfig[];
  private cache: CardCache;

  constructor(params: {
    realms: RealmConfig[];
    cardCacheDir: string;
    pkgName: string;
  }) {
    this.realms = params.realms;
    this.cache = new CardCache(params.cardCacheDir, params.pkgName);
  }

  private async define(
    cardURL: string,
    localPath: string,
    type: string,
    source: string
  ): Promise<string> {
    let url = this.cache.setModule(BROWSER, cardURL, localPath, source);

    switch (type) {
      case JS_TYPE:
        this.cache.setModule(
          NODE,
          cardURL,
          localPath,
          this.transformToCommonJS(localPath, source)
        );
        return url;
      default:
        return this.cache.writeAsset(cardURL, localPath, source);
    }
  }

  private transformToCommonJS(moduleURL: string, source: string): string {
    let out = transformSync(source, {
      configFile: false,
      babelrc: false,
      filenameRelative: moduleURL,
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return out!.code!;
  }

  locateCardDir(url: string): string {
    for (let realm of this.realms) {
      if (!url.startsWith(realm.url)) {
        continue;
      }

      let realmPath = join(realm.directory, url.replace(realm.url, ''));
      if (existsSync(realmPath)) {
        return realmPath;
      }
    }

    throw new NotFound(`${url} is not a card we know about`);
  }

  async getRawCard(url: string): Promise<RawCard> {
    let dir = this.locateCardDir(url);
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

    return this.buildCard(url);
  }

  async buildCard(url: string): Promise<CompiledCard> {
    let rawCard = await this.getRawCard(url);
    let compiledCard = await this.compileCardFromRaw(url, rawCard);

    return compiledCard;
  }

  async updateCardData(url: string, payload: any) {
    let fullPath = join(this.locateCardDir(url), 'card.json');

    // Builder: merge data into card.json
    let card = readJsonSync(fullPath);
    card.data = Object.assign(card.data, payload);
    writeJsonSync(fullPath, card);

    // Cache: Merge data into compiled.json
    let compiledCard = await this.getCompiledCard(url);
    compiledCard.data = Object.assign(compiledCard.data, payload);
    this.cache.setCard(url, compiledCard);
    return compiledCard;
  }

  async compileCardFromRaw(
    url: string,
    rawCard: RawCard
  ): Promise<CompiledCard> {
    let compiledCard = await this.compiler.compile(rawCard);
    this.cache.setCard(url, compiledCard);
    return compiledCard;
  }

  deleteCard(cardURL: string) {
    this.cache.deleteCard(cardURL);

    let cardDir = this.locateCardDir(cardURL);
    removeSync(cardDir);
  }
}
