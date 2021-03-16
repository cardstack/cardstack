import type {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
} from '@cardstack/core/src/interfaces';
import { Compiler } from '@cardstack/core/src/compiler';
import { compileTemplate } from 'cardhost/tests/helpers/template-compiler';
import templateOnlyComponent from '@ember/component/template-only';
import { setComponentTemplate } from '@ember/component';

export default class Builder implements BuilderInterface {
  private compiler = new Compiler({
    lookup: (url: string) => this.getCompiledCard(url),
  });

  private cache: Map<string, CompiledCard>;

  constructor() {
    this.cache = new Map();
  }

  async getRawCard(url: string): Promise<RawCard> {
    let response = await fetch(`${url}?type=raw`);
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
    format: 'isolated' | 'embedded'
  ): Promise<{ model: any; componentImplementation: unknown }> {
    let compiledCard = await this.getCompiledCard(url);
    let templateSource = compiledCard.templateSources[format];
    let componentImplementation = setComponentTemplate(
      compileTemplate(templateSource),
      templateOnlyComponent()
    );
    return { model: compiledCard.data, componentImplementation };
  }
}
