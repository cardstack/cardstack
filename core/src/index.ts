import { transformSync } from '@babel/core';
// @ts-ignore
import decoratorsPlugin from '@babel/plugin-proposal-decorators';
// @ts-ignore
import classPropertiesPlugin from '@babel/plugin-proposal-class-properties';

import cardPlugin, { getMeta } from './card-babel-plugin';

interface RawCard {
  'schema.js': string;
}

interface CompiledCard {
  modelSource: string;
  fields: {
    [key: string]:
      | {
          hasMany: CompiledCard;
        }
      | {
          belongsTo: CompiledCard;
        }
      | {
          contains: CompiledCard;
        }
      | {
          containsMany: CompiledCard;
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

    return {
      modelSource: out!.code!,
      fields: meta.fields as any,
    };
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
