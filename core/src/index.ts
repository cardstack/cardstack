import * as syntax from '@glimmer/syntax';
import { transformSync } from '@babel/core';
// @ts-ignore
import decoratorsPlugin from '@babel/plugin-proposal-decorators';
// @ts-ignore
import classPropertiesPlugin from '@babel/plugin-proposal-class-properties';

import cardPlugin, { getMeta } from './card-babel-plugin';
import cardGlimmerPlugin from './card-glimmer-plugin';
import { CompiledCard, RawCard } from './interfaces';

export class Compiler {
  async compile(cardSource: RawCard): Promise<CompiledCard> {
    let options = {};

    let out = transformSync(cardSource['schema.js'], {
      plugins: [
        [cardPlugin, options],
        [
          decoratorsPlugin,
          {
            decoratorsBeforeExport: false,
          },
        ],
        classPropertiesPlugin,
      ],
    });

    let meta = getMeta(options);

    let fields: CompiledCard['fields'] = {};
    for (let [name, { cardURL, type }] of Object.entries(meta.fields)) {
      fields[name] = {
        card: await this.lookup(cardURL),
        type,
      };
    }

    // TODO: inherit all the way up to base, so these are never undefined
    let isolated = '';
    let embedded = '';

    if (cardSource['isolated.hbs']) {
      isolated = syntax.print(
        syntax.preprocess(cardSource['isolated.hbs'], {
          mode: 'codemod',
          plugins: {
            ast: [cardGlimmerPlugin({ fields })],
          },
        })
      );
    }

    return {
      url: cardSource.url,
      modelSource: out!.code!,
      fields,
      templateSources: {
        isolated,
        embedded,
      },
    };
  }

  async lookup(cardURL: string): Promise<CompiledCard> {
    switch (cardURL) {
      case 'https://cardstack.com/base/models/string':
        return {
          url: cardURL,
          modelSource: '',
          fields: {},
          templateSources: {
            embedded: `{{this}}`,
            isolated: '',
          },
        };
      case 'https://cardstack.com/base/models/date':
        return {
          url: cardURL,
          modelSource: '',
          fields: {},
          templateSources: {
            embedded: `<FormatDate @date={{this}} />`,
            isolated: '',
          },
        };
      case 'https://localhost/base/models/person':
        return {
          url: cardURL,
          modelSource: '',
          fields: {
            name: {
              type: 'contains',
              card: await this.lookup(
                'https://cardstack.com/base/models/string'
              ),
            },
            birthdate: {
              type: 'contains',
              card: await this.lookup('https://cardstack.com/base/models/date'),
            },
          },
          templateSources: {
            embedded: `{{this.name}} was born on <FormatDate @date={{this.birthdate}}/>`,
            isolated: '',
          },
        };
      case 'https://localhost/base/models/comment':
        return {
          url: cardURL,
          modelSource: '',
          fields: {},
          templateSources: {
            embedded: `{{this}}`,
            isolated: '',
          },
        };
      case 'https://localhost/base/models/tag':
        return {
          url: cardURL,
          modelSource: '',
          fields: {},
          templateSources: {
            embedded: `{{this}}`,
            isolated: '',
          },
        };
      default:
        throw new Error(`unknown card ${cardURL}`);
    }
  }
}

export function field(/*card: CompiledCard*/) {
  return function (desc: {
    key: string;
    initializer: ((initialValue: any) => any) | undefined;
  }) {
    function initializer(value: any) {
      return value;
    }
    desc.initializer = initializer;
    return desc;
  };
}
