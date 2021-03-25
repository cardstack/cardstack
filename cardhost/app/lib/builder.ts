import type {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
} from '@cardstack/core/src/interfaces';
import { transformSync } from '@babel/core';
import { Compiler } from '@cardstack/core/src/compiler';

// @ts-ignore
import HTMLBarsCompiler from 'ember-template-compiler/vender/ember-template-compiler';
// @ts-ignore
import HTMLBarsInlinePrecompile from 'babel-plugin-htmlbars-inline-precompile';
export default class Builder implements BuilderInterface {
  private compiler = new Compiler({
    lookup: (url) => this.getCompiledCard(url),
    define: (...args) => this.defineModule(...args),
  });

  private cache: Map<string, CompiledCard>;
  private realm?: string;

  constructor(params: { realm?: string }) {
    this.cache = new Map();
    this.realm = params.realm;
  }

  private async defineModule(moduleURL: string, source: string): Promise<void> {
    console.debug('DEFINE', moduleURL, source);

    let out = transformSync(source, {
      plugins: [
        [HTMLBarsInlinePrecompile, { precompile: HTMLBarsCompiler.precompile }],
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    source = out!.code!;

    (window as any).define(moduleURL, function () {
      return source;
    });
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
  ): Promise<{ model: any; moduleName: string }> {
    let compiledCard = await this.getCompiledCard(url);

    return {
      model: compiledCard.data,
      moduleName: compiledCard.templateModules[format].moduleName,
    };
  }
}
