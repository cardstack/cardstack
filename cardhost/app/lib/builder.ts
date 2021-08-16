import { CSS_TYPE, JS_TYPE } from '@cardstack/core/src/utils/content';
import {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
} from '@cardstack/core/src/interfaces';
import { Compiler } from '@cardstack/core/src/compiler';
import { encodeCardURL } from '@cardstack/core/src/utils';
import dynamicCardTransform from './dynamic-card-transform';

// This is neccessary to get the base model available to ember
import * as CardModel from '@cardstack/core/src/card-model';
(window as any).define('@cardstack/core/src/card-model', function () {
  return CardModel;
});

export interface Cache<CardType> {
  get(url: string): CardType | undefined;
  set(url: string, payload: CardType): void;
  update(url: string, payload: CardType): void;
  delete(url: string): void;
}

class SimpleCache<CardType> implements Cache<CardType> {
  cache: Map<string, CardType>;

  constructor() {
    this.cache = new Map();
  }
  get(url: string): CardType | undefined {
    return this.cache.get(url);
  }
  set(url: string, payload: CardType): void {
    this.cache.set(url, payload);
  }
  update(url: string, payload: CardType): void {
    this.cache.set(url, payload);
  }
  delete(url: string): void {
    this.cache.delete(url);
  }
}

export default class Builder implements BuilderInterface {
  private compiler = new Compiler({
    builder: this,
    define: (...args) => this.defineModule(...args),
  });

  private compiledCardCache: Cache<CompiledCard>;
  private rawCardCache: Cache<RawCard>;
  private seenModuleCache: Set<string> = new Set();

  constructor(params?: {
    compiledCardCache?: Cache<CompiledCard>;
    rawCardCache?: Cache<RawCard>;
  }) {
    let { compiledCardCache, rawCardCache } = params || {};
    this.compiledCardCache =
      compiledCardCache || new SimpleCache<CompiledCard>();
    this.rawCardCache = rawCardCache || new SimpleCache<RawCard>();
  }

  private async defineModule(
    cardURL: string,
    localModule: string,
    type: string,
    source: string
  ): Promise<string> {
    let url = new URL(localModule, cardURL.replace(/\/$/, '') + '/').href;
    this.seenModuleCache.add(url);
    switch (type) {
      case JS_TYPE:
        eval(dynamicCardTransform(url, source));
        return url;
      case CSS_TYPE:
        eval(`
          define('${url}', function(){
            const style = document.createElement('style');
            style.innerHTML = \`${source}\`;
            style.setAttribute('data-asset-url', '${url}');
            document.head.appendChild(style);
          })
        `);
        return url;
      default:
        return url;
    }
  }

  cleanup(): void {
    for (const url of this.seenModuleCache) {
      // Clear the require registry because it's a noop if we require the same modules in another test
      delete (window.require as any).entries[url];
    }
  }

  async getRawCard(url: string): Promise<RawCard> {
    let raw = this.rawCardCache.get(url);
    if (raw) {
      return raw;
    }
    let response = await fetch(`/sources/${encodeCardURL(url)}`);
    if (!response || response.status === 404) {
      throw Error(`Card Builder: No raw card found for ${url}`);
    }
    let responseBody = await response.json();
    raw = responseBody.data.attributes.raw as RawCard;
    this.rawCardCache.set(url, raw);
    return raw;
  }

  async getCompiledCard(url: string): Promise<CompiledCard> {
    let compiledCard = this.compiledCardCache.get(url);

    if (compiledCard) {
      return compiledCard;
    }
    let rawCard = await this.getRawCard(url);
    compiledCard = await this.compiler.compile(rawCard);
    this.compiledCardCache.set(url, compiledCard);
    return compiledCard;
  }
}
