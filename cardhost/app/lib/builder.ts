import type {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
  Asset,
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
    source: string
  ): Promise<string> {
    let url = new URL(localModule, cardURL.replace(/\/$/, '') + '/').href;
    source = dynamicCardTransform(url, source);
    eval(source);
    return url;
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
    this.copyAssets(url, compiledCard.assets, rawCard.files);
    this.compiledCardCache.set(url, compiledCard);
    return compiledCard;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  copyAssets(url: string, assets: Asset[], files: RawCard['files']): void {
    let styles: string[] = [];
    if (!files) {
      return;
    }

    for (const asset of assets) {
      if (asset.type === 'css') {
        styles = styles.concat([
          `/* card:${url} asset:${asset.path} */`,
          files[asset.path],
          '\n',
        ]);
      } else {
        console.warn(
          `A card declared an asset that the Builder is ignoring. ${url}:${asset.path}`
        );
      }
    }

    if (styles.length) {
      const style = document.createElement('style');
      style.innerHTML = styles.join('\n');
      style.setAttribute('data-assets-for-card', url);
      document.head.appendChild(style);
    }
  }
}
