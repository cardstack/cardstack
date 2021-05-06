import { transformSync } from '@babel/core';
// @ts-ignore
import decoratorsPlugin from '@babel/plugin-proposal-decorators';
// @ts-ignore
import classPropertiesPlugin from '@babel/plugin-proposal-class-properties';
import difference from 'lodash/difference';
import intersection from 'lodash/intersection';

import cardSchemaPlugin, {
  FieldsMeta,
  getMeta,
  PluginMeta,
} from './babel/card-schema-plugin';
import cardTemplatePlugin, {
  Options as CardTemplateOptions,
} from './babel/card-template-plugin';
import {
  Asset,
  AssetType,
  CardData,
  CompiledCard,
  ComponentInfo,
  Fields,
  Format,
  RawCard,
} from './interfaces';
import { BadRequest } from '@cardstack/server/src/middleware/error';

function getNonAssetFilePaths(sourceCard: RawCard): (string | undefined)[] {
  return [sourceCard.schema, sourceCard.isolated, sourceCard.embedded].filter(
    Boolean
  );
}

export class Compiler {
  lookup: (cardURL: string) => Promise<CompiledCard>;

  // returns the module identifier that can be used to get this module back.
  // It's exactly meaning depends on the environment. In node it's a path you
  // can actually `require`.
  define: (
    cardURL: string,
    localModule: string,
    source: string
  ) => Promise<string>;

  constructor(params: {
    lookup: (url: string) => Promise<CompiledCard>;
    define: Compiler['define'];
  }) {
    this.lookup = params.lookup;
    this.define = params.define;
  }

  async compile(cardSource: RawCard): Promise<CompiledCard> {
    if (cardSource.url === compiledBaseCard.url) {
      return compiledBaseCard;
    }

    let options = {};
    let modelModuleName = await this.prepareSchema(cardSource, options);
    let meta = getMeta(options);
    let fields = await this.lookupFieldsForCard(meta.fields);
    let assets = this.buildAssetsList(cardSource);

    let parentCard = await this.getParentCard(cardSource, meta);
    if (parentCard) {
      fields = this.adoptFields(fields, parentCard);
    }

    assertValidData(fields, cardSource.data, cardSource.url);

    let card: CompiledCard = {
      url: cardSource.url,
      modelModule: modelModuleName ?? parentCard.modelModule,
      fields,
      data: cardSource.data,
      assets,
      isolated: await this.prepareComponent(
        cardSource,
        fields,
        parentCard,
        'isolated'
      ),
      embedded: await this.prepareComponent(
        cardSource,
        fields,
        parentCard,
        'embedded'
      ),
    };

    if (parentCard) {
      card['adoptsFrom'] = parentCard;
    }

    return card;
  }

  private buildAssetsList(sourceCard: RawCard): (Asset | undefined)[] {
    let assets: (Asset | undefined)[] = [];

    if (!sourceCard.files) {
      return assets;
    }

    let assetPaths = difference(
      Object.keys(sourceCard.files),
      getNonAssetFilePaths(sourceCard)
    );

    for (const p of assetPaths) {
      if (!p) {
        continue;
      }

      assets.push({
        type: getAssetType(p),
        path: p,
      });
    }

    return assets;
  }

  private getCardParentPath(
    cardSource: RawCard,
    meta: PluginMeta
  ): string | undefined {
    let parentPath;

    if (cardSource.adoptsFrom) {
      parentPath = cardSource.adoptsFrom;
    }

    if (meta.parent && meta.parent.cardURL) {
      if (parentPath && parentPath !== meta.parent.cardURL) {
        throw new Error(
          `${cardSource.url} provides conflicting parent URLs in card.json and schema.js`
        );
      }
      parentPath = meta.parent.cardURL;
    }

    return parentPath;
  }

  private async getParentCard(
    cardSource: RawCard,
    meta: PluginMeta
  ): Promise<CompiledCard> {
    let parentCard: CompiledCard;
    let parentCardPath = this.getCardParentPath(cardSource, meta);

    if (parentCardPath) {
      // TODO: Confirm the path correctly depthed
      let url = new URL(parentCardPath, cardSource.url).href;
      parentCard = await this.lookup(url);
    } else {
      // the base card from which all other cards derive
      parentCard = compiledBaseCard;
    }
    return parentCard;
  }

  getSource(cardSource: RawCard, path: string): string {
    let schemaSrc = cardSource.files[path];
    if (!schemaSrc) {
      throw new Error(
        `${cardSource.url} refers to ${path} in its card.json but that file does not exist`
      );
    }
    return schemaSrc;
  }

  // returns the module name of our own compiled schema, if we have one. Does
  // not recurse into parent, because we don't necessarily know our parent until
  // after we've tried to compile our own
  private async prepareSchema(
    cardSource: RawCard,
    options: Object
  ): Promise<string | undefined> {
    let schemaLocalFilePath = cardSource.schema;
    if (!schemaLocalFilePath) {
      if (cardSource.files && cardSource.files['schema.js']) {
        console.warn(
          `You did not specify what is your schema file, but a schema.js file exists. Using schema.js. url = ${cardSource.url}`
        );
      }

      return undefined;
    }
    let schemaSrc = this.getSource(cardSource, schemaLocalFilePath);
    let out = transformSync(schemaSrc, {
      plugins: [
        [cardSchemaPlugin, options],
        [decoratorsPlugin, { decoratorsBeforeExport: false }],
        classPropertiesPlugin,
      ],
    });

    let code = out!.code!;
    return await this.define(cardSource.url, schemaLocalFilePath, code);
  }

  async lookupFieldsForCard(
    metaFields: FieldsMeta
  ): Promise<CompiledCard['fields']> {
    let fields: CompiledCard['fields'] = {};
    for (let [name, { cardURL, type }] of Object.entries(metaFields)) {
      fields[name] = {
        card: await this.lookup(cardURL),
        type,
        name,
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

  private async prepareComponent(
    cardSource: RawCard,
    fields: CompiledCard['fields'],
    parentCard: CompiledCard,
    which: Format
  ): Promise<ComponentInfo> {
    let localFilePath = cardSource[which];
    if (!localFilePath) {
      return parentCard[which];
    }

    let src = this.getSource(cardSource, localFilePath);
    return await this.compileComponent(
      src,
      fields,
      cardSource.url,
      localFilePath
    );
  }

  private async compileComponent(
    templateSource: string,
    fields: CompiledCard['fields'],
    cardURL: string,
    localFile: string
  ): Promise<ComponentInfo> {
    let options: CardTemplateOptions = {
      fields,
      cardURL,
      localFile,
      inlineHBS: undefined,
      usedFields: [] as ComponentInfo['usedFields'],
    };
    let out = transformSync(templateSource, {
      plugins: [[cardTemplatePlugin, options]],
    });

    return {
      moduleName: await this.define(cardURL, localFile, out!.code!),
      usedFields: options.usedFields,
      inlineHBS: options.inlineHBS,
    };
  }
}

// it's easier to hand-compile and hard-code the base card rather than make the
// card compiler always support the case of an undefined parentCard. This is the
// only card with no parentCard
export const compiledBaseCard: CompiledCard = {
  url: 'https://cardstack.com/base/base',
  fields: {},
  data: undefined,
  modelModule: 'todo',
  isolated: {
    moduleName: 'todo',
    usedFields: [],
  },
  embedded: {
    moduleName: 'todo',
    usedFields: [],
  },
  assets: [],
};

function getAssetType(filename: string): AssetType {
  if (filename.endsWith('.css')) {
    return 'css';
  }

  return 'unknown';
}

function assertValidData(
  fields: Fields,
  data: CardData | undefined,
  url: string
) {
  if (!data) {
    return;
  }

  let unexpectedFields = difference(Object.keys(data), Object.keys(fields));

  if (unexpectedFields.length) {
    // TODO: This shouldn't know about requests or whether they were bad
    throw new BadRequest(
      `Field(s) "${unexpectedFields.join(
        ', '
      )}" does not exist on card "${url}"`
    );
  }
}
