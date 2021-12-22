import {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
  Saved,
  ModuleRef,
  Unsaved,
} from '@cardstack/core/src/interfaces';
import { Compiler, makeGloballyAddressable } from '@cardstack/core/src/compiler';

import { inject } from '@cardstack/di';
import { JS_TYPE } from '@cardstack/core/src/utils/content';
import { BROWSER, NODE } from '../interfaces';
import { transformSync } from '@babel/core';
// @ts-ignore
import TransformModulesCommonJS from '@babel/plugin-transform-modules-commonjs';
// @ts-ignore
import ClassPropertiesPlugin from '@babel/plugin-proposal-class-properties';

import logger from '@cardstack/logger';
const log = logger('hub/card-builder');

export default class CardBuilder implements BuilderInterface {
  realmManager = inject('realm-manager', { as: 'realmManager' });
  cache = inject('card-cache', { as: 'cache' });
  cards = inject('card-service', { as: 'cards' });

  async getRawCard(url: string): Promise<RawCard> {
    log.trace('getRawCard: %s', url);
    return await this.realmManager.read(this.realmManager.parseCardURL(url.replace(/\/$/, '')));
  }

  async getCompiledCard(url: string): Promise<CompiledCard> {
    log.trace('getCompiledCard: %s', url);
    let cached = this.cache.getCard(url);
    if (cached) {
      return cached;
    }
    let cardSource = await this.getRawCard(url);
    let compiledCard: CompiledCard<Saved, ModuleRef> | undefined;
    let err: unknown;
    try {
      let compiler = new Compiler({ builder: this, cardSource });
      compiledCard = await compiler.compile();
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
    log.trace('define: %s %s', cardURL, { localPath, type });
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

  compileCardFromRaw<Identity extends Saved | Unsaved>(cardSource: RawCard<Identity>): Compiler<Identity> {
    return new Compiler({ builder: this, cardSource });
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-builder': CardBuilder;
  }
}
