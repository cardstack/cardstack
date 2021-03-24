import type {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
  defineModuleCallback,
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
    lookup: (url: string) => this.getCompiledCard(url),
    define: (...args: Parameters<defineModuleCallback>) =>
      this.defineModule(...args),
  });

  private cache: Map<string, CompiledCard>;
  private realm: string;
  customDefine: (fullModulePath: string, source: unknown) => void;

  constructor(params: {
    realm?: string;
    defineModule: (fullModulePath: string, source: unknown) => void;
  }) {
    this.cache = new Map();
    this.customDefine = params.defineModule;
    this.realm = params.realm ?? '';
  }

  async defineModule(...args: Parameters<defineModuleCallback>): Promise<void> {
    let [fullModuleURL, source] = args;

    // TODO: Handle prefixing/rewriting based on Realm
    //
    // let modulePath = this.getFullModuleURL(cardURL, moduleName);
    // fullModuleURL = fullModuleURL.replace('http://mirage/cards', this.realm);
    this.customDefine(fullModuleURL, source);
  }

  getFullModuleURL(cardURL: string, moduleName: string): string {
    return `${this.realm}${cardURL}/${moduleName}`;
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
