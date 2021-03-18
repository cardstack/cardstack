import type {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
  defineModuleCallback,
} from '@cardstack/core/src/interfaces';
import { Compiler } from '@cardstack/core/src/compiler';
import { compileTemplate } from 'cardhost/tests/helpers/template-compiler';
import templateOnlyComponent from '@ember/component/template-only';
import { setComponentTemplate } from '@ember/component';

export default class Builder implements BuilderInterface {
  private compiler = new Compiler({
    lookup: (url: string) => this.getCompiledCard(url),
    define: (cardURL, module, source) =>
      this.defineModule(cardURL, module, source),
  });

  private cache: Map<string, CompiledCard>;
  private modulePrefix: string;
  customDefine: (fullModulePath: string, source: unknown) => void;

  constructor(params: {
    modulePrefix?: string;
    defineModule: (fullModulePath: string, source: unknown) => void;
  }) {
    this.cache = new Map();
    this.customDefine = params.defineModule;
    this.modulePrefix = params.modulePrefix ?? '';
  }

  // TODO: is there a way to reuse the arguments of the defineModuleCallback type?
  async defineModule(
    cardURL: string,
    moduleName: string,
    source: unknown
  ): Promise<void> {
    let modulePath = this.getFullModuleURL(cardURL, moduleName);
    this.customDefine(modulePath, source);
  }

  getFullModuleURL(cardURL: string, moduleName: string): string {
    return `${this.modulePrefix}${cardURL}/${moduleName}`;
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
    let templateSource = await window.require(
      this.getFullModuleURL(
        compiledCard.url,
        compiledCard.templateModules[format].moduleName
      )
    );
    let componentImplementation = setComponentTemplate(
      compileTemplate(templateSource),
      templateOnlyComponent()
    );
    this.defineModule(
      compiledCard.url,
      compiledCard.modelModule,
      componentImplementation
    );
    return { model: compiledCard.data, moduleName: compiledCard.modelModule };
  }
}
