import type {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
} from '@cardstack/core/src/interfaces';
import { Compiler } from '@cardstack/core/src/compiler';
// import { compileTemplate } from 'cardhost/tests/helpers/template-compiler';
// import templateOnlyComponent from '@ember/component/template-only';
// import { setComponentTemplate } from '@ember/component';

// import { precompile } from '@glimmer/compiler';
// import type { TemplateFactory } from 'htmlbars-inline-precompile';

// // @ts-ignore
// import { createTemplateFactory } from '@ember/template-factory';
// function compileTemplate(source: string): TemplateFactory {
//   return createTemplateFactory(JSON.parse(precompile(source)));
// }

export default class Builder implements BuilderInterface {
  private compiler = new Compiler({
    lookup: (url) => this.getCompiledCard(url),
    define: (...args) => this.defineModule(...args),
  });

  private cache: Map<string, CompiledCard>;
  private realm: string;

  constructor(params: { realm?: string }) {
    this.cache = new Map();
    this.realm = params.realm ?? '';
  }

  private async defineModule(moduleURL: string, source: string): Promise<void> {
    console.debug('DEFINE', moduleURL, source);

    // TODO: here is where we transpile the module for browser use

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
    // let templateSource = await window.require(
    //   compiledCard.templateModules[format].moduleName
    // );
    // let componentImplementation = setComponentTemplate(
    //   compileTemplate(templateSource),
    //   templateOnlyComponent()
    // );
    // this.defineModule(compiledCard.modelModule, templateSource);

    /*
      TODO Build stage:
        1. Require template module from it's path, eg: "http://mirage/cards/hello/isolated"
        2. Babel transpile it
        3. Do the createTemplateFactory song and dance?
        4. Redefine the module? Make a new definintion?
    */
    return {
      model: compiledCard.data,
      moduleName: compiledCard.templateModules[format].moduleName,
    };
  }
}
