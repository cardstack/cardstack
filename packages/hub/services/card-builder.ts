import {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
  Saved,
  ModuleRef,
  Unsaved,
  NewRawCard,
} from '@cardstack/core/src/interfaces';
import { Compiler, makeGloballyAddressable } from '@cardstack/core/src/compiler';

import { inject } from '@cardstack/di';
import { serverLog as logger } from '../utils/logger';
import { JS_TYPE } from '@cardstack/core/src/utils/content';
import { BROWSER, NODE } from '../interfaces';
import { transformSync } from '@babel/core';
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

  async getRawCard(url: string): Promise<RawCard> {
    return await this.realmManager.read(this.realmManager.parseCardURL(url.replace(/\/$/, '')));
  }

  async getCompiledCard(url: string): Promise<CompiledCard> {
    let cached = this.cache.getCard(url);
    if (cached) {
      return cached;
    }
    let rawCard = await this.getRawCard(url);
    let compiledCard: CompiledCard<Saved, ModuleRef> | undefined;
    let err: unknown;
    try {
      compiledCard = await this.compiler.compile(rawCard);
    } catch (e) {
      err = e;
    }
    if (compiledCard) {
      let definedCard = makeGloballyAddressable(url, compiledCard, (local, type, src) =>
        this.define(url, local, type, src)
      );
      this.cache.setCard(url, definedCard);
      return definedCard;
    } else {
      this.cache.deleteCard(url);
      throw err;
    }
  }

  private define(cardURL: string, localPath: string, type: string, source: string): string {
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

  async compileCardFromRaw(rawCard: NewRawCard): Promise<CompiledCard<Unsaved, ModuleRef>>;
  async compileCardFromRaw(rawCard: RawCard): Promise<CompiledCard<Saved, ModuleRef>>;
  async compileCardFromRaw(rawCard: NewRawCard | RawCard): Promise<CompiledCard<Unsaved | Saved, ModuleRef>> {
    return await this.compiler.compile(rawCard);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-builder': CardBuilder;
  }
}
