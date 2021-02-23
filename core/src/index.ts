import * as syntax from '@glimmer/syntax';
import { transformSync } from '@babel/core';
// @ts-ignore
import decoratorsPlugin from '@babel/plugin-proposal-decorators';
// @ts-ignore
import classPropertiesPlugin from '@babel/plugin-proposal-class-properties';

import cardPlugin, { getMeta } from './card-babel-plugin';
import cardGlimmerPlugin from './card-glimmer-plugin';
import {
  CompiledCard,
  RawCard,
  templateFileName,
  templateTypes,
} from './interfaces';

import { FIXTURES } from '../tests/helpers';

const BASE_CARDS: Map<string, CompiledCard> = new Map([
  [
    'https://cardstack.com/base/models/string',
    {
      url: 'https://cardstack.com/base/models/string',
      modelSource: '',
      fields: {},
      templateSources: {
        embedded: `{{this}}`,
        isolated: '',
      },
    },
  ],
  [
    'https://cardstack.com/base/models/date',
    {
      url: 'https://cardstack.com/base/models/date',
      modelSource: '',
      fields: {},
      templateSources: {
        embedded: `<FormatDate @date={{this}} />`,
        isolated: '',
      },
    },
  ],
  [
    'https://localhost/base/models/comment',
    {
      url: 'https://localhost/base/models/comment',
      modelSource: '',
      fields: {},
      templateSources: {
        embedded: `{{this}}`,
        isolated: '',
      },
    },
  ],
  [
    'https://localhost/base/models/tag',
    {
      url: 'https://localhost/base/models/tag',
      modelSource: '',
      fields: {},
      templateSources: {
        embedded: `{{this}}`,
        isolated: '',
      },
    },
  ],
]);
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

    if (meta.parent) {
      let parentCard = await this.lookup(meta.parent.cardURL);
      Object.assign(fields, parentCard.fields);
    }

    // TODO: inherit all the way up to base, so these are never undefined
    let templateSources: CompiledCard['templateSources'] = {
      isolated: '',
      embedded: '',
    };

    for (let templateType of templateTypes) {
      let source = cardSource[templateFileName(templateType)];

      if (source) {
        templateSources[templateType] = syntax.print(
          syntax.preprocess(source, {
            mode: 'codemod',
            plugins: {
              ast: [cardGlimmerPlugin({ fields })],
            },
          })
        );
      }
    }

    return {
      url: cardSource.url,
      modelSource: out!.code!,
      fields,
      templateSources,
    };
  }

  async lookup(cardURL: string): Promise<CompiledCard> {
    let card = BASE_CARDS.get(cardURL) ?? FIXTURES.get(cardURL);

    if (!card) {
      throw new Error(`unknown card ${cardURL}`);
    }

    return card;
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
