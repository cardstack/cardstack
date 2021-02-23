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

import intersection from 'lodash/intersection';
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
    let parentCard;

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

    if (meta.parent) {
      parentCard = await this.lookup(meta.parent.cardURL);
    }

    let fields: CompiledCard['fields'] = {};
    for (let [name, { cardURL, type }] of Object.entries(meta.fields)) {
      fields[name] = {
        card: await this.lookup(cardURL),
        type,
      };
    }

    if (parentCard) {
      let cardFieldNames = Object.keys(fields);
      let parentFieldNames = Object.keys(parentCard.fields);

      let fieldNameCollisions = intersection(cardFieldNames, parentFieldNames);

      if (fieldNameCollisions.length) {
        throw Error(
          `Field collision on ${fieldNameCollisions.join()} with parent card ${
            parentCard.url
          }`
        );
      }

      Object.assign(fields, parentCard.fields);
    }

    // TODO: inherit all the way up to base, so these are never undefined
    let templateSources: CompiledCard['templateSources'] = {
      isolated: '',
      embedded: '',
    };

    for (let templateType of templateTypes) {
      let filename = templateFileName(templateType);
      let source = cardSource[filename];

      if (source) {
        templateSources[templateType] = syntax.print(
          syntax.preprocess(source, {
            mode: 'codemod',
            plugins: {
              ast: [cardGlimmerPlugin({ fields })],
            },
          })
        );
      } else if (parentCard) {
        templateSources[templateType] =
          parentCard.templateSources[templateType];
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
