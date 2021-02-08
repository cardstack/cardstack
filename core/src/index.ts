import { transformSync } from '@babel/core';
// @ts-ignore
import decoratorsPlugin from '@babel/plugin-proposal-decorators';
// @ts-ignore
import classPropertiesPlugin from '@babel/plugin-proposal-class-properties';

import cardPlugin, { getMeta } from './card-babel-plugin';

interface RawCard {
  url?: string;
  'schema.js': string;
}

interface CompiledCard {
  url: string | undefined;
  modelSource: string;
  fields: {
    [key: string]: {
      type: 'hasMany' | 'belongsTo' | 'contains' | 'containsMany';
      card: CompiledCard;
    };
  };
}

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

    return {
      url: cardSource.url,
      modelSource: out!.code!,
      fields,
    };
  }

  async lookup(cardURL: string): Promise<CompiledCard> {
    switch (cardURL) {
      case 'https://cardstack.com/base/models/string':
        return {
          url: cardURL,
          modelSource: '',
          fields: {},
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
