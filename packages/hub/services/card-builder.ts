import { Builder as BuilderInterface, RawCard, CompiledCard } from '@cardstack/core/src/interfaces';
import { Compiler } from '@cardstack/core/src/compiler';

import { transformSync } from '@babel/core';
import { NODE, BROWSER } from '../interfaces';
import { JS_TYPE } from '@cardstack/core/src/utils/content';
import { inject } from '@cardstack/di';
import { serverLog as logger } from '../utils/logger';

// @ts-ignore
import TransformModulesCommonJS from '@babel/plugin-transform-modules-commonjs';
// @ts-ignore
import ClassPropertiesPlugin from '@babel/plugin-proposal-class-properties';

export default class CardBuilder implements BuilderInterface {
  realmManager = inject('realm-manager', { as: 'realmManager' });
  cache = inject('card-cache', { as: 'cache' });
  cards = inject('card-service', { as: 'cards' });

  logger = logger;

  private compiler = new Compiler({
    builder: this,
  });

  private async define(cardURL: string, localPath: string, type: string, source: string): Promise<string> {
    switch (type) {
      case JS_TYPE:
        this.cache.setModule(BROWSER, cardURL, localPath, source);
        return this.cache.setModule(NODE, cardURL, localPath, this.transformToCommonJS(localPath, source));
      default:
        return this.cache.writeAsset(cardURL, localPath, source);
    }
  }

  private transformToCommonJS(moduleURL: string, source: string): string {
    let out = transformSync(source, {
      configFile: false,
      babelrc: false,
      filenameRelative: moduleURL,
      plugins: [ClassPropertiesPlugin, TransformModulesCommonJS],
    });
    return out!.code!;
  }

  async getRawCard(url: string): Promise<RawCard> {
    return await this.realmManager.read(url.replace(/\/$/, ''));
  }

  async getCompiledCard(url: string): Promise<CompiledCard> {
    let compiledCard = this.cache.getCard(url);
    if (compiledCard) {
      return compiledCard;
    }
    let rawCard = await this.getRawCard(url);
    return await this.compileCardFromRaw(rawCard);
  }

  async compileCardFromRaw(rawCard: RawCard): Promise<CompiledCard> {
    let compiledCard: CompiledCard | undefined;
    let err: unknown;
    try {
      compiledCard = await this.compiler.compile(rawCard);
    } catch (e) {
      err = e;
    }
    if (compiledCard) {
      this.cache.setCard(rawCard.url, compiledCard);
      return compiledCard;
    } else {
      this.cache.deleteCard(rawCard.url);
      throw err;
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-builder': CardBuilder;
  }
}
