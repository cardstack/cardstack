import { CSS_TYPE, JS_TYPE } from '@cardstack/core/src/utils/content';
import {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
} from '@cardstack/core/src/interfaces';
import { Compiler } from '@cardstack/core/src/compiler';
import dynamicCardTransform from './dynamic-card-transform';

// This is neccessary to get the base model available to ember
import * as CardModel from '@cardstack/core/src/card-model';
import Cards from 'cardhost/services/cards';

(window as any).define('@cardstack/core/src/card-model', function () {
  return CardModel;
});

export default class Builder implements BuilderInterface {
  private compiler = new Compiler({
    builder: this,
    define: (...args) => this.defineModule(...args),
  });

  private seenModuleCache: Set<string> = new Set();
  private compiledCardCache: Map<string, CompiledCard> = new Map();

  constructor(private cards: Cards, private ownRealmURL: string) {}

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
    // TODO: we can put our local realm in charge of holding these modules so cleanup is simpler
    for (const url of this.seenModuleCache) {
      // Clear the require registry because it's a noop if we require the same modules in another test
      delete (window.require as any).entries[url];
    }
  }

  async getRawCard(url: string): Promise<RawCard> {
    return this.cards.getRawCard(url);
  }

  async getCompiledCard(url: string): Promise<CompiledCard> {
    if (!url.startsWith(this.ownRealmURL)) {
      return this.cards.getCompiledCard(url);
    }
    let compiledCard = this.compiledCardCache.get(url);
    if (compiledCard) {
      return compiledCard;
    }
    let rawCard = await this.cards.getRawCard(url);
    compiledCard = await this.compiler.compile(rawCard);
    this.compiledCardCache.set(url, compiledCard);
    return compiledCard;
  }
}
