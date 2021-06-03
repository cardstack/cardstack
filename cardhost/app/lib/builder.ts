import { CSS_TYPE, JS_TYPE } from '@cardstack/core/src/utils/content';
import type {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
} from '@cardstack/core/src/interfaces';
import { Compiler } from '@cardstack/core/src/compiler';
import { encodeCardURL } from '@cardstack/core/src/utils';

import dynamicCardTransform from './dynamic-card-transform';

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

  constructor(params?: {
    compiledCardCache?: Cache<CompiledCard>;
    rawCardCache?: Cache<RawCard>;
  }) {
    this.compiledCardCache =
      params?.compiledCardCache || new SimpleCache<CompiledCard>();
    this.rawCardCache = params?.rawCardCache || new SimpleCache<RawCard>();
  }

  private async defineModule(
    cardURL: string,
    localModule: string,
    type: string,
    source: string
  ): Promise<string> {
    let url = new URL(localModule, cardURL.replace(/\/$/, '') + '/').href;

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

  async getRawCard(url: string): Promise<RawCard> {
    let raw = this.rawCardCache.get(url);
    if (raw) {
      return raw;
    }
    let response = await fetch(`/cards/${encodeCardURL(url)}?type=raw`);
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

  async updateCardData(url: string, attributes: any): Promise<CompiledCard> {
    let compiledCard = await this.getCompiledCard(url);

    let rawCard = this.rawCardCache.get(url);

    if (rawCard) {
      rawCard.data = Object.assign(rawCard.data, attributes);
      this.rawCardCache.update(url, rawCard);
    }

    compiledCard.data = Object.assign(compiledCard.data, attributes);
    this.compiledCardCache.set(url, compiledCard);

    return compiledCard;
  }
}
