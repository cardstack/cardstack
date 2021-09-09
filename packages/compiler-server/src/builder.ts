import { Builder as BuilderInterface, RawCard, CompiledCard } from '@cardstack/core/src/interfaces';
import { Compiler } from '@cardstack/core/src/compiler';

import { transformSync } from '@babel/core';
import { NODE, BROWSER } from './interfaces';
import { CardCache } from './cache';
import { JS_TYPE } from '@cardstack/core/src/utils/content';
import RealmManager from './realm-manager';

export default class Builder implements BuilderInterface {
  private compiler = new Compiler({
    builder: this,
  });

  private realms: RealmManager;
  private cache: CardCache;

  constructor(params: { realms: RealmManager; cardCacheDir: string; pkgName: string }) {
    this.realms = params.realms;
    this.cache = new CardCache(params.cardCacheDir, params.pkgName);
  }

  async define(cardURL: string, localPath: string, type: string, source: string): Promise<string> {
    let url = this.cache.setModule(BROWSER, cardURL, localPath, source);

    switch (type) {
      case JS_TYPE:
        this.cache.setModule(NODE, cardURL, localPath, this.transformToCommonJS(localPath, source));
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
      plugins: ['@babel/plugin-proposal-class-properties', '@babel/plugin-transform-modules-commonjs'],
    });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return out!.code!;
  }

  async getRawCard(url: string): Promise<RawCard> {
    url = url.replace(/\/$/, '');
    return this.realms.getRawCard(url);
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
    let compiledCard = await this.compileCardFromRaw(rawCard);

    return compiledCard;
  }

  private async compileCardFromRaw(rawCard: RawCard): Promise<CompiledCard> {
    let compiledCard = await this.compiler.compile(rawCard);
    this.cache.setCard(rawCard.url, compiledCard);

    return compiledCard;
  }

  async deleteCard(cardURL: string) {
    await this.cache.deleteCard(cardURL);
    await this.realms.deleteCard(cardURL);
  }
}
