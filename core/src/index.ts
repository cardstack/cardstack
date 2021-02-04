import { transformSync } from '@babel/core';
// @ts-ignore
import decoratorsPlugin from '@babel/plugin-proposal-decorators';
// @ts-ignore
import classPropertiesPlugin from '@babel/plugin-proposal-class-properties';

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
