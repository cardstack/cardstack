import walkSync from 'walk-sync';
import { readFileSync, existsSync } from 'fs-extra';
import { join } from 'path';

import {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
  assertValidRawCard,
  RealmConfig,
  Asset,
} from '@cardstack/core/src/interfaces';
import { Compiler } from '@cardstack/core/src/compiler';

import { NotFound } from './middleware/error';
import { transformSync } from '@babel/core';
import { NODE, BROWSER } from './interfaces';
import { CardCache } from './cache';

export default class Builder implements BuilderInterface {
  private compiler = new Compiler({
    lookup: (url) => this.getCompiledCard(url),
    define: (...args) => this.defineModule(...args),
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

  private async defineModule(
    cardURL: string,
    localModule: string,
    source: string
  ): Promise<string> {
    let url = this.cache.setModule(BROWSER, cardURL, localModule, source);

    let nodeSource = this.transformToCommonJS(localModule, source);
    this.cache.setModule(NODE, cardURL, localModule, nodeSource);

    return url;
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

  copyAssets(
    cardURL: string,
    assets: (Asset | undefined)[],
    files: RawCard['files']
  ): void {
    for (const asset of assets) {
      if (!asset) {
        continue;
      }
      this.cache.writeAsset(cardURL, asset.path, files[asset.path]);
    }
  }

  async buildCard(url: string): Promise<CompiledCard> {
    let rawCard = await this.getRawCard(url);
    let compiledCard = await this.compileCardFromRaw(url, rawCard);
    this.copyAssets(url, compiledCard.assets, rawCard.files);
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
}
