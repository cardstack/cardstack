import { JS_TYPE } from './utils/content';
import { BabelFileResult, transformSync } from '@babel/core';
// @ts-ignore
import decoratorsPlugin from '@babel/plugin-proposal-decorators';
// @ts-ignore
import classPropertiesPlugin from '@babel/plugin-proposal-class-properties';
import difference from 'lodash/difference';
import intersection from 'lodash/intersection';
import reduce from 'lodash/reduce';
import md5 from 'md5';

import cardSchemaPlugin, { FieldsMeta, getMeta, PluginMeta } from './babel-plugin-card-schema';
import transformCardComponent, {
  CardComponentPluginOptions as CardComponentPluginOptions,
} from './babel-plugin-card-template';
import { Builder, CompiledCard, ComponentInfo, FEATURE_NAMES, Format, FORMATS, RawCard } from './interfaces';
import { getBasenameAndExtension, resolveCardURL } from './utils';
import { getFileType } from './utils/content';
import { CardstackError, BadRequest, augmentBadRequest } from './utils/errors';

export const baseCardURL = 'https://cardstack.com/base/base';

function getNonAssetFilePaths(sourceCard: RawCard): (string | undefined)[] {
  let paths: string[] = [];
  for (const feature of FEATURE_NAMES) {
    paths.push(sourceCard[feature]);
  }
  return paths.filter(Boolean);
}

export class Compiler {
  builder: Builder;
  compiledBaseCard?: CompiledCard;

  constructor(params: { builder: Builder }) {
    this.builder = params.builder;
  }

  async compile(cardSource: RawCard): Promise<CompiledCard> {
    let options = {};
    let schemaModule = await this.prepareSchema(cardSource, options);
    let meta = getMeta(options);

    let fields = await this.lookupFieldsForCard(meta.fields, cardSource.url);

    this.defineAssets(cardSource);

    let parentCard;
    let serializer = cardSource.deserializer;

    if (isBaseCard(cardSource.url)) {
      schemaModule = 'todo';
    } else {
      parentCard = await this.getParentCard(cardSource, meta);

      if (!parentCard) {
        throw new CardstackError(`${cardSource.url} does not have a parent card. This is wrong and should not happen.`);
      }

      if (!schemaModule) {
        schemaModule = parentCard.schemaModule;
      }

      fields = this.adoptFields(fields, parentCard);

      if (parentCard.serializer) {
        if (serializer && parentCard.serializer !== serializer) {
          throw new CardstackError(
            `Your card declares a different deserializer than your parent. Thats not allowed. Card: ${cardSource.url}:${serializer} Parent: ${parentCard.url}:${parentCard.serializer}`
          );
        }
        serializer = parentCard.serializer;
      }
    }

    let components = await this.prepareComponents(cardSource, fields, parentCard);

    if (cardSource.data) {
      let unexpectedFields = difference(Object.keys(cardSource.data), Object.keys(fields));
      if (unexpectedFields.length) {
        throw new BadRequest(`Fields() ${unexpectedFields.join(',')} does not exist on card "${cardSource.url}"`);
      }
    }

    return {
      url: cardSource.url,
      serializer,
      schemaModule,
      fields,
      adoptsFrom: parentCard,
      ...components,
    };
  }

  private defineAssets(sourceCard: RawCard) {
    if (!sourceCard.files) {
      return;
    }

    let assetPaths = difference(Object.keys(sourceCard.files), getNonAssetFilePaths(sourceCard));

    for (const p of assetPaths) {
      if (!p) {
        continue;
      }

      let src = this.getFile(sourceCard, p);
      this.builder.define(sourceCard.url, p, getFileType(p), src);
    }
  }

  private getCardParentPath(cardSource: RawCard, meta: PluginMeta): string | undefined {
    let parentPath;
    let { url, adoptsFrom } = cardSource;

    if (adoptsFrom) {
      if (adoptsFrom === url) {
        throw new Error(`BUG: ${url} provides itself as its parent. That should not happen.`);
      }
      parentPath = cardSource.adoptsFrom;
    }

    if (meta.parent && meta.parent.cardURL) {
      if (parentPath && parentPath !== meta.parent.cardURL) {
        throw new Error(`${url} provides conflicting parent URLs in card.json and schema.js`);
      }
      parentPath = meta.parent.cardURL;
    }

    return parentPath;
  }

  private async getParentCard(cardSource: RawCard, meta: PluginMeta): Promise<CompiledCard> {
    let parentCardPath = this.getCardParentPath(cardSource, meta);
    let url = parentCardPath ? resolveCardURL(parentCardPath, cardSource.url) : baseCardURL;
    try {
      return await this.builder.getCompiledCard(url);
    } catch (err: any) {
      if (!err.isCardstackError || err.status !== 404) {
        throw err;
      }
      let newErr = new CardstackError(`tried to adopt from card ${url} but it failed to load`, { status: 422 });
      newErr.additionalErrors = [err, ...(err.additionalErrors || [])];
      throw newErr;
    }
  }

  private getFile(cardSource: RawCard, path: string): string {
    let fileSrc = cardSource.files && cardSource.files[path];
    if (!fileSrc) {
      throw new CardstackError(`${cardSource.url} refers to ${path} in its card.json but that file does not exist`);
    }
    return fileSrc;
  }

  // returns the module name of our own compiled schema, if we have one. Does
  // not recurse into parent, because we don't necessarily know our parent until
  // after we've tried to compile our own
  private async prepareSchema(cardSource: RawCard, options: any): Promise<string | undefined> {
    let schemaLocalFilePath = cardSource.schema;
    if (!schemaLocalFilePath) {
      if (cardSource.files && cardSource.files['schema.js']) {
        console.warn(
          `You did not specify what is your schema file, but a schema.js file exists. Using schema.js. url = ${cardSource.url}`
        );
      }

      return undefined;
    }
    let schemaSrc = this.getFile(cardSource, schemaLocalFilePath);
    let out: BabelFileResult;
    try {
      out = transformSync(schemaSrc, {
        plugins: [
          [cardSchemaPlugin, options],
          [decoratorsPlugin, { decoratorsBeforeExport: false }],
          classPropertiesPlugin,
        ],
      })!;
    } catch (error: any) {
      throw augmentBadRequest(error);
    }

    let code = out!.code!;
    return await this.builder.define(cardSource.url, schemaLocalFilePath, JS_TYPE, code);
  }

  private async lookupFieldsForCard(metaFields: FieldsMeta, ownURL: string): Promise<CompiledCard['fields']> {
    let fields: CompiledCard['fields'] = {};
    for (let [name, { cardURL, type }] of Object.entries(metaFields)) {
      let fieldURL = resolveCardURL(cardURL, ownURL);
      fields[name] = {
        card: await this.builder.getCompiledCard(fieldURL),
        type,
        name,
      };
    }

    return fields;
  }

  private adoptFields(fields: CompiledCard['fields'], parentCard: CompiledCard): CompiledCard['fields'] {
    let cardFieldNames = Object.keys(fields);
    let parentFieldNames = Object.keys(parentCard.fields);
    let fieldNameCollisions = intersection(cardFieldNames, parentFieldNames);

    if (fieldNameCollisions.length) {
      throw new CardstackError(`Field collision on ${fieldNameCollisions.join()} with parent card ${parentCard.url}`);
    }

    return Object.assign({}, parentCard.fields, fields);
  }

  private async prepareComponents(
    cardSource: RawCard,
    fields: CompiledCard['fields'],
    parentCard: CompiledCard | undefined
  ) {
    let components: Partial<Pick<CompiledCard, Format>> = {};
    for (const format of FORMATS) {
      components[format] = await this.prepareComponent(cardSource, fields, parentCard, format);
    }
    return components as Pick<CompiledCard, Format>;
  }

  private async prepareComponent(
    cardSource: RawCard,
    fields: CompiledCard['fields'],
    parentCard: CompiledCard | undefined,
    which: Format
  ): Promise<ComponentInfo> {
    let localFilePath = cardSource[which];

    if (!localFilePath) {
      // we don't have an implementation of our own
      if (!parentCard) {
        throw new CardstackError(
          `${cardSource.url} doesn't have a ${which} component OR a parent card. This is not right.`
        );
      }

      if (cardSource.schema) {
        // recompile parent component because we extend the schema
        let originalRawCard = await this.builder.getRawCard(parentCard[which].sourceCardURL);
        let srcLocalPath = originalRawCard[which];
        if (!srcLocalPath) {
          throw new CardstackError(
            `bug: ${parentCard.url} says it got ${which} from ${parentCard[which].sourceCardURL}, but that card does not have a ${which} component`
          );
        }
        let src = this.getFile(originalRawCard, srcLocalPath);
        return await this.compileComponent(src, fields, originalRawCard.url, srcLocalPath, which);
      } else {
        // directly reuse existing parent component because we didn't extend
        // anything
        return parentCard[which];
      }
    }

    let src = this.getFile(cardSource, localFilePath);
    return await this.compileComponent(src, fields, cardSource.url, localFilePath, which);
  }

  private async compileComponent(
    templateSource: string,
    fields: CompiledCard['fields'],
    cardURL: string,
    localFile: string,
    format: Format
  ): Promise<ComponentInfo> {
    let options: CardComponentPluginOptions = {
      cardURL,
      componentFile: localFile,
      fields,
      inlineHBS: undefined,
      defaultFieldFormat: defaultFieldFormat(format),
      usedFields: [],
    };

    let code: string;
    code = transformCardComponent(templateSource, options);
    let moduleName = await this.builder.define(cardURL, hashFilenameFromFields(localFile, fields), JS_TYPE, code);

    let componentInfo: ComponentInfo = {
      moduleName,
      usedFields: options.usedFields,
      inlineHBS: options.inlineHBS,
      sourceCardURL: cardURL,
    };

    return componentInfo;
  }
}

function hashFilenameFromFields(localFile: string, fields: CompiledCard['fields']): string {
  let { basename, extension } = getBasenameAndExtension(localFile);
  let hash = md5(
    reduce(
      fields,
      (result, f, name) => {
        return (result += name + f.card.url);
      },
      ''
    )
  );
  return `${basename}-${hash}${extension}`;
}

function isBaseCard(url: string): boolean {
  return url === baseCardURL;
}

// we expect this to expand when we add edit format
function defaultFieldFormat(format: Format): Format {
  switch (format) {
    case 'isolated':
    case 'embedded':
      return 'embedded';
    case 'edit':
      return 'edit';
  }
}
