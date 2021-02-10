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
        return await this.compile({
          url: cardURL,
          'schema.js': `
            import { contains } from "@cardstack/types";
            import date from "https://cardstack.com/base/models/date";
            import string from "https://cardstack.com/base/models/string";
            export default class Person {
              @contains(string)
              name;

              @contains(date)
              birthdate;
            }
          `,
          'embedded.hbs': `<this.name/> was born on <this.birthdate/>`,
          'isolated.hbs': '',
        });
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
