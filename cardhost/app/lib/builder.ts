import type {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
  Format,
} from '@cardstack/core/src/interfaces';
// import { RealmConfig } from '@cardstack/core/src/interfaces';
import { Compiler } from '@cardstack/core/src/compiler';
import { encodeCardURL } from '@cardstack/core/src/utils';

import dynamicCardTransform from './dynamic-card-transform';

export default class Builder implements BuilderInterface {
  private compiler = new Compiler({
    lookup: (url) => this.getCompiledCard(url),
    define: (...args) => this.defineModule(...args),
  });

  private cache: Map<string, CompiledCard>;
  // private realms: [{ url: string }];

  constructor(/*params: { realms: RealmConfig[] }*/) {
    this.cache = new Map();
    // this.realms = params.realms;
  }

  private async defineModule(
    cardURL: string,
    localModule: string,
    source: string
  ): Promise<string> {
    let url = encodeCardURL(
      new URL(localModule, cardURL.replace(/\/$/, '') + '/').href
    );
    source = dynamicCardTransform(url, source);
    eval(source);
    return url;
  }

  async getRawCard(url: string): Promise<RawCard> {
    let response = await fetch(`/cards/${encodeCardURL(url)}?type=raw`);
    if (!response || response.status === 404) {
      throw Error(`Card Builder: No raw card found for ${url}`);
    }
    let responseBody = await response.json();
    return responseBody.data.attributes.raw;
  }

  async getCompiledCard(url: string): Promise<CompiledCard> {
    let compiledCard = this.cache.get(url);

    // Typescript didn't seem to trust this.cache.has(...) as a sufficient null guarentee
    if (compiledCard) {
      return compiledCard;
    }

    let rawCard = await this.getRawCard(url);
    compiledCard = await this.compiler.compile(rawCard);
    this.cache.set(url, compiledCard);
    return compiledCard;
  }

  // the component that comes out of here is the actual card-author-provided
  // component, ready to run in the browser. That is different from what gets
  // returned by the cards service, which encapsulates both the component
  // implementation and the data to give you a single thing you can render.
  async getBuiltCard(
    url: string,
    format: Format
  ): Promise<{ model: any; moduleName: string }> {
    let compiledCard = await this.getCompiledCard(url);

    return {
      model: compiledCard.data,
      moduleName: compiledCard[format].moduleName,
    };
  }
}
