import { transformSync } from '@babel/core';
// @ts-ignore
import decoratorsPlugin from '@babel/plugin-proposal-decorators';
// @ts-ignore
import classPropertiesPlugin from '@babel/plugin-proposal-class-properties';

import cardPlugin from './card-babel-plugin';

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
    let out = transformSync(cardSource['schema.js'], {
      plugins: [
        cardPlugin,
        [
          decoratorsPlugin,
          {
            decoratorsBeforeExport: false,
          },
        ],
        classPropertiesPlugin,
      ],
    });
    return {
      modelSource: out!.code!,
      fields: {},
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
