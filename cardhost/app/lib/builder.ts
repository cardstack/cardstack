import { CSS_TYPE, JS_TYPE } from '@cardstack/core/src/utils/content';
import type {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
} from '@cardstack/core/src/interfaces';
import { Compiler } from '@cardstack/core/src/compiler';
import { encodeCardURL } from '@cardstack/core/src/utils';

import dynamicCardTransform from './dynamic-card-transform';

export default class Builder implements BuilderInterface {
  private compiler = new Compiler({
    builder: this,
    define: (...args) => this.defineModule(...args),
  });

  private compiledCardCache: Map<string, CompiledCard>;
  private rawCardCache: Map<string, RawCard>;

  constructor(/*params: { realms: RealmConfig[] }*/) {
    this.compiledCardCache = new Map();
    this.rawCardCache = new Map();
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

    // Typescript didn't seem to trust this.cache.has(...) as a sufficient null guarentee
    if (compiledCard) {
      return compiledCard;
    }

    let rawCard = await this.getRawCard(url);
    compiledCard = await this.compiler.compile(rawCard);
    this.compiledCardCache.set(url, compiledCard);
    return compiledCard;
  }
}
