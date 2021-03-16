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
} from './interfaces';

import intersection from 'lodash/intersection';
export class Compiler {
  lookup: (cardURL: string) => Promise<CompiledCard>;

  constructor(params: { lookup: (url: string) => Promise<CompiledCard> }) {
    this.lookup = params.lookup;
  }
  async compile(cardSource: RawCard): Promise<CompiledCard> {
    let options = {};
    let parentCard;

    let code = this.transformSchema(cardSource.files['schema.js'], options);
    let data = this.getData(cardSource.files['data.json']);
    let meta = getMeta(options);

    if (meta.parent) {
      parentCard = await this.lookup(meta.parent.cardURL);
    }

    let fields = await this.lookupFieldsForCard(meta.fields);

    if (parentCard) {
      fields = this.adoptFields(fields, parentCard);
    }

    // TODO: inherit all the way up to base, so these are never undefined
    let templateSources: CompiledCard['templateSources'] = {
      isolated: '',
      embedded: '',
    };

    for (let templateType of templateTypes) {
      templateSources[templateType] = this.compileOrAdoptTemplate(
        cardSource,
        templateType,
        fields,
        parentCard
      );
    }

    let card: CompiledCard = {
      url: cardSource.url,
      modelSource: code,
      fields,
      data,
      templateSources,
    };
    if (parentCard) {
      card['adoptsFrom'] = parentCard;
    }
    return card;
  }

  transformSchema(schema: string, options: Object): string {
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

    return out!.code!;
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
  ): string {
    let template = '';
    let source = cardSource.files[templateFileName(templateType)];

    if (source) {
      template = this.compileTemplate(source, fields);
    } else if (parentCard) {
      template = parentCard.templateSources[templateType];
    }
    // TODO: there should always be a template

    return template;
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
