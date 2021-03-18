import * as syntax from '@glimmer/syntax';
import { transformSync } from '@babel/core';
// @ts-ignore
import decoratorsPlugin from '@babel/plugin-proposal-decorators';
// @ts-ignore
import classPropertiesPlugin from '@babel/plugin-proposal-class-properties';

import cardPlugin, { FieldsMeta, getMeta } from './card-babel-plugin';
import cardGlimmerPlugin from './card-glimmer-plugin';
import {
  CompiledCard,
  RawCard,
  RawCardData,
  templateFileName,
  TemplateType,
  templateTypes,
  defineModuleCallback,
} from './interfaces';

import intersection from 'lodash/intersection';

// Eventually this will be dynamically configured
const MODEL_MODULE_NAME = 'model';
export class Compiler {
  lookup: (cardURL: string) => Promise<CompiledCard>;
  define: defineModuleCallback;

  constructor(params: {
    lookup: (url: string) => Promise<CompiledCard>;
    define: defineModuleCallback;
  }) {
    this.lookup = params.lookup;
    this.define = params.define;
  }
  async compile(cardSource: RawCard): Promise<CompiledCard> {
    let options = {};
    let parentCard;

    let modelModuleName = this.transformAndDefineSchema(
      cardSource.url,
      cardSource.files['schema.js'],
      options
    );
    let data = this.getData(cardSource.files['data.json']);
    let meta = getMeta(options);

    if (meta.parent) {
      parentCard = await this.lookup(meta.parent.cardURL);
    }

    let fields = await this.lookupFieldsForCard(meta.fields);

    if (parentCard) {
      fields = this.adoptFields(fields, parentCard);
    }

    let templateModules = this.prepareTemplates(cardSource, fields, parentCard);

    let card: CompiledCard = {
      url: cardSource.url,
      modelModule: modelModuleName,
      fields,
      data,
      templateModules: templateModules,
    };
    if (parentCard) {
      card['adoptsFrom'] = parentCard;
    }
    return card;
  }

  transformAndDefineSchema(
    url: string,
    schema: string,
    options: Object
  ): string {
    let out = transformSync(schema, {
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

    let code = out!.code!;

    this.define(url, MODEL_MODULE_NAME, code);
    return MODEL_MODULE_NAME;
  }

  prepareTemplates(
    cardSource: RawCard,
    fields: CompiledCard['fields'],
    parentCard?: CompiledCard
  ): CompiledCard['templateModules'] {
    // TODO: inherit all the way up to base, so these are never undefined
    let templateModules: CompiledCard['templateModules'] = {
      isolated: { moduleName: 'isolated' },
      embedded: { moduleName: 'embedded' },
    };

    for (let templateType of templateTypes) {
      this.compileOrAdoptTemplate(cardSource, templateType, fields, parentCard);
    }

    return templateModules;
  }

  getData(data: RawCardData | undefined): any {
    return data?.attributes ?? {};
  }

  async lookupFieldsForCard(
    metaFields: FieldsMeta
  ): Promise<CompiledCard['fields']> {
    let fields: CompiledCard['fields'] = {};
    for (let [name, { cardURL, type }] of Object.entries(metaFields)) {
      fields[name] = {
        card: await this.lookup(cardURL),
        type,
      };
    }

    return fields;
  }

  adoptFields(
    fields: CompiledCard['fields'],
    parentCard: CompiledCard
  ): CompiledCard['fields'] {
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

    return Object.assign(fields, parentCard.fields);
  }

  compileOrAdoptTemplate(
    cardSource: RawCard,
    templateType: TemplateType,
    fields: CompiledCard['fields'],
    parentCard?: CompiledCard
  ): void {
    let template = '';
    let source = cardSource.files[templateFileName(templateType)];

    if (source) {
      template = this.compileTemplate(source, fields);
      this.define(cardSource.url, templateType, template);
    } else if (parentCard) {
      // TODO: return the parent cards module?
      // template = parentCard.templateModules[templateType];
    }
  }

  compileTemplate(source: string, fields: CompiledCard['fields']): string {
    return syntax.print(
      syntax.preprocess(source, {
        mode: 'codemod',
        plugins: {
          ast: [cardGlimmerPlugin({ fields })],
        },
      })
    );
  }
}
