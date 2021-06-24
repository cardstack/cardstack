import { Compiler } from '@cardstack/core/src/compiler';
import {
  Asset,
  Builder,
  CompiledCard,
  RawCard,
} from '@cardstack/core/src/interfaces';
import { setupCardBuilding } from '../../src/context/card-building';
import { BASE_CARD_REALM_CONFIG } from '../helpers/fixtures';
import { createCardCacheDir } from '../helpers/cache';

const baseBuilder = (() => {
  let { cardCacheDir } = createCardCacheDir();
  return setupCardBuilding({
    realms: [BASE_CARD_REALM_CONFIG],
    cardCacheDir,
  });
})();

export class TestBuilder implements Builder {
  compiler: Compiler;
  rawCards: Map<string, RawCard> = new Map();
  definedModules: Map<string, string> = new Map();

  constructor() {
    this.compiler = new Compiler({
      builder: this,
      define: this.define.bind(this),
    });
  }

  async getRawCard(url: string): Promise<RawCard> {
    let card = this.rawCards.get(url);
    if (!card) {
      card = await baseBuilder.getRawCard(url);
    }
    return card;
  }

  async getCompiledCard(url: string): Promise<CompiledCard> {
    let card = this.rawCards.get(url);
    if (card) {
      return await this.compiler.compile(card);
    } else {
      return await baseBuilder.getCompiledCard(url);
    }
  }

  private async define(
    cardURL: string,
    localModule: string,
    type: Asset['type'] | 'js',
    src: string
  ): Promise<string> {
    let moduleName = cardURL.replace(/\/$/, '') + '/' + localModule;

    switch (type) {
      case 'unknown':
      case 'css':
        return moduleName;
      case 'js':
        this.definedModules.set(moduleName, src);
        return moduleName;
    }
  }

  addRawCard(rawCard: RawCard) {
    this.rawCards.set(rawCard.url, rawCard);
  }
}
