import type {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
} from '@cardstack/core/src/interfaces';
import { Compiler } from '@cardstack/core/src/compiler';

import { transformSync } from '@babel/core';
import type { TransformOptions } from '@babel/core';
import { ColocatedBabelPlugin } from '@cardstack/core/src/babel/utils';

// TODO can't find import targets, so the preset arent working
// import targets from 'cardhost/config/targets';
// import PresetEnv from '@babel/preset-env';

import { precompile } from '@glimmer/compiler';
// @ts-ignore
import HTMLBarsInlinePrecompile from 'babel-plugin-htmlbars-inline-precompile';
// @ts-ignore
import EmberModulesApiPolyfill from 'babel-plugin-ember-modules-api-polyfill';
// @ts-ignore
import TransformModulesAmd from '@babel/plugin-transform-modules-amd';

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

  private async defineModule(
    moduleURL: string,
    source: string,
    type: 'Schema' | 'Template'
  ): Promise<void> {
    let out = transformSync(source, this.babelConfig(type));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    source = out!.code!;

    if (type === 'Template') {
      // TODO: This can't be right. This requires adding ['default] after the imports.
      // I imagine there is a babel plugin that may clear that up as well...
      eval(source.replace('([', `("${moduleURL}", [`));
    } else {
      (window as any).define(moduleURL, function () {
        return source;
      });
    }
  }

  private babelConfig(type: 'Schema' | 'Template'): TransformOptions {
    let ensureModuleApiPolyfill = true; // For now?Not sure we need this...

    let plugins = [
      [
        HTMLBarsInlinePrecompile,
        {
          ensureModuleApiPolyfill,
          precompile,
          modules: {
            'ember-cli-htmlbars': 'hbs',
            '@ember/template-compilation': {
              export: 'precompileTemplate',
              disableTemplateLiteral: true,
              shouldParseScope: true,
              isProduction: process.env.EMBER_ENV === 'production',
            },
          },
        },
      ],
    ];

    if (ensureModuleApiPolyfill) {
      plugins.push([EmberModulesApiPolyfill]);
    }
    plugins.push([ColocatedBabelPlugin]);

    if (type === 'Template') {
      plugins.push([TransformModulesAmd, { noInterop: true }]);
    }

    return {
      configFile: false,
      babelrc: false,
      plugins,
      // presets: [
      //   [
      //     PresetEnv,
      //     {
      //       modules: false,
      //       targets,
      //     },
      //   ],
      // ],
    };
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
