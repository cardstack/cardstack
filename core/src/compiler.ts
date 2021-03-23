import { transformSync } from '@babel/core';
// @ts-ignore
import decoratorsPlugin from '@babel/plugin-proposal-decorators';
// @ts-ignore
import classPropertiesPlugin from '@babel/plugin-proposal-class-properties';

import cardSchemaPlugin, {
  FieldsMeta,
  getMeta,
} from './card-schema-babel-plugin';
import cardTemplatePlugin from './card-template-babel-plugin';
import {
  CompiledCard,
  RawCard,
  RawCardData,
  templateFileName,
  templateTypes,
  defineModuleCallback,
  TemplateModule,
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

    let modelModuleName = this.prepareSchema(
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

  /**
   * For the compiled module paths, we generate predictable urls based off
   * the provided cardUrl and module name. This will later be modified by
   * the builder to handle various contexts
   */
  getFullModulePath(cardURL: string, moduleName: string): string {
    return `${cardURL}/${moduleName}`;
  }

  prepareSchema(url: string, schema: string, options: Object): string {
    let out = transformSync(schema, {
      plugins: [
        [cardSchemaPlugin, options],
        [decoratorsPlugin, { decoratorsBeforeExport: false }],
        classPropertiesPlugin,
      ],
    });

    let code = out!.code!;

    let fullModulePath = this.getFullModulePath(url, MODEL_MODULE_NAME);
    this.define(fullModulePath, code);

    return fullModulePath;
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

  prepareTemplates(
    cardSource: RawCard,
    fields: CompiledCard['fields'],
    parentCard?: CompiledCard
  ): CompiledCard['templateModules'] {
    let templateModules: CompiledCard['templateModules'] = {
      isolated: { moduleName: 'isolated' },
      embedded: { moduleName: 'embedded' },
    };

    for (let templateType of templateTypes) {
      let template;
      let templateSource = cardSource.files[templateFileName(templateType)];
      let templateModule = templateModules[templateType];

      if (templateSource) {
        template = this.compileTemplate(templateSource, fields, templateModule);

        let fullModulePath = this.getFullModulePath(
          cardSource.url,
          templateType
        );
        templateModule.moduleName = fullModulePath;
        this.define(fullModulePath, template);
      } else if (parentCard) {
        templateModule.moduleName =
          parentCard.templateModules[templateType].moduleName;
      } else {
        // TODO: Likely this should error, but not all of our test scenarios have full
        // fallback set up. Not sure how to handle that just yet
        // throw Error(
        //   `Card:${cardSource.url} has no template for type ${templateType}. This should not happen`
        // );
      }
    }

    return templateModules;
  }

  compileTemplate(
    templateSource: string,
    fields: CompiledCard['fields'],
    templateModule: TemplateModule
  ): string {
    let out = transformSync(templateSource, {
      plugins: [[cardTemplatePlugin, { fields, templateModule }]],
    });

    return out!.code!;
  }
}
