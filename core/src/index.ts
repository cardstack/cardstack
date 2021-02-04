import { transformSync } from '@babel/core';
// @ts-ignore
import decoratorsPlugin from '@babel/plugin-proposal-decorators';
// @ts-ignore
import classPropertiesPlugin from '@babel/plugin-proposal-class-properties';
import classPropertiesSyntax from '@babel/plugin-syntax-class-properties';

import cardPlugin from './card-babel-plugin';

interface RawCard {
  'schema.js': string;
}

interface CompiledCard {
  modelSource: string;
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
    };
  }
}

const fieldMap = new WeakMap();

export function field(card) {
  return function (desc) {
    let { key } = desc;
    function initializer(value) {
      let fieldList = fieldMap.get(this);
      if (!fieldList) {
        fieldList = [];
        fieldMap.set(this, fieldList);
        this.fields = fieldList;
      }
      fieldList.push(key);
      return value;
    }
    desc.initializer = initializer;
    return desc;
  };
}
