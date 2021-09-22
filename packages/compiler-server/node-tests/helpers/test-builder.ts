import { CompiledCard, Builder as BuilderInterface, RawCard } from '@cardstack/core/src/interfaces';
import { Compiler } from '@cardstack/core/src/compiler';
import { createCardCacheDir } from './cache';
import { CSS_TYPE, JS_TYPE } from '@cardstack/core/src/utils/content';
import { ensureTrailingSlash } from '../../src/utils/path';
import Builder from '@cardstack/compiler-server/src/builder';
import RealmManager from '../../src/realm-manager';
import { BASE_CARD_REALM_CONFIG } from './fixtures';

const baseBuilder = (() => {
  let { cardCacheDir } = createCardCacheDir();
  let realms = new RealmManager([BASE_CARD_REALM_CONFIG]);

  return new Builder({
    realms,
    cardCacheDir,
    pkgName: '@cardstack/compiled',
  });
})();

export class TestBuilder implements BuilderInterface {
  compiler: Compiler;
  rawCards: Map<string, RawCard> = new Map();
  definedModules: Map<string, string> = new Map();

  constructor() {
    this.compiler = new Compiler({
      builder: this,
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

  async define(cardURL: string, localModule: string, type: string, src: string): Promise<string> {
    let moduleName = ensureTrailingSlash(cardURL) + localModule;

    switch (type) {
      case JS_TYPE:
        this.definedModules.set(moduleName, src);
        return moduleName;

      case CSS_TYPE:
        this.definedModules.set(moduleName, src);
        return moduleName;

      default:
        return moduleName;
    }
  }

  addRawCard(rawCard: RawCard) {
    this.rawCards.set(rawCard.url, rawCard);
  }
}
