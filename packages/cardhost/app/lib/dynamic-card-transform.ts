import { transformSync } from '@babel/core';
import type { TransformOptions } from '@babel/core';
import { ColocatedBabelPlugin } from '@cardstack/core/src/utils/babel';

import { precompile } from '@glimmer/compiler';
// import { precompile } from 'ember-source/dist/ember-template-compiler';
// @ts-ignore
import HTMLBarsInlinePrecompile from 'babel-plugin-htmlbars-inline-precompile';
// @ts-ignore
import EmberModulesApiPolyfill from 'babel-plugin-ember-modules-api-polyfill';
// @ts-ignore
import TransformModulesAmd from '@babel/plugin-transform-modules-amd';
// @ts-ignore
import ClassPropertiesPlugin from '@babel/plugin-proposal-class-properties';

/**
 * Transfrom a compiled card to a runtime card
 *
 * This is the final step of the dynamic building process.
 */
export default function dynamicCardTransform(
  moduleURL: string,
  source: string
): string {
  let out = transformSync(source, babelConfig(moduleURL));
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return out!.code!;
}

function babelConfig(moduleURL: string): TransformOptions {
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
  plugins.push([ClassPropertiesPlugin]);
  plugins.push([
    TransformModulesAmd,
    {
      noInterop: true,
      moduleId: moduleURL,
    },
  ]);

  return {
    configFile: false,
    babelrc: false,
    filenameRelative: moduleURL,
    plugins,
  };
}
