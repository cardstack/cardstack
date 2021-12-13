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
import {
  Builder,
  CompiledCard,
  ComponentInfo,
  FEATURE_NAMES,
  Format,
  FORMATS,
  GlobalRef,
  LocalRef,
  ModuleRef,
  NewRawCard,
  RawCard,
  Saved,
  Unsaved,
} from './interfaces';
import { ensureTrailingSlash, getBasenameAndExtension } from './utils';
import { getFileType } from './utils/content';
import { CardstackError, BadRequest, augmentBadRequest } from './utils/errors';

export const baseCardURL = 'https://cardstack.com/base/base';

function getNonAssetFilePaths(sourceCard: NewRawCard): (string | undefined)[] {
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

  async compile(cardSource: RawCard): Promise<CompiledCard<Saved, ModuleRef>>;
  async compile(cardSource: NewRawCard): Promise<CompiledCard<Unsaved, ModuleRef>>;
  async compile(cardSource: NewRawCard | RawCard): Promise<CompiledCard<Saved | Unsaved, ModuleRef>> {
    let options = {};
    let modules: CompiledCard['modules'] = {};
    let schemaModule: ModuleRef | undefined = await this.prepareSchema(cardSource, options, modules);
    let meta = getMeta(options);

    let fields = await this.lookupFieldsForCard(meta.fields, cardSource.realm);

    this.defineAssets(cardSource, modules);

    let parentCard;
    let serializer = cardSource.deserializer;

    if (isBaseCard(cardSource)) {
      schemaModule = { global: 'todo' };
    } else {
      parentCard = await this.getParentCard(cardSource, meta);

      if (!parentCard) {
        throw new CardstackError(`Failed to find a parent card. This is wrong and should not happen.`);
      }

      if (!schemaModule) {
        schemaModule = parentCard.schemaModule;
      }

      fields = this.adoptFields(fields, parentCard);

      if (parentCard.serializer) {
        if (serializer && parentCard.serializer !== serializer) {
          throw new CardstackError(
            `Your card declares a different deserializer than your parent. Thats not allowed. Card: ${serializer} Parent: ${parentCard.url}:${parentCard.serializer}`
          );
        }
        serializer = parentCard.serializer;
      }
    }

    let components = await this.prepareComponents(cardSource, fields, parentCard, modules);

    if (cardSource.data) {
      let unexpectedFields = difference(Object.keys(cardSource.data), Object.keys(fields));
      if (unexpectedFields.length) {
        throw new BadRequest(`Fields() ${unexpectedFields.join(',')} does not exist on this card`);
      }
    }

    return {
      realm: cardSource.realm,
      url: cardSource.id ? `${cardSource.realm}${cardSource.id}` : undefined,
      serializer,
      schemaModule,
      fields,
      adoptsFrom: parentCard,
      ...components,
      modules,
    };
  }

  private defineAssets(sourceCard: NewRawCard | RawCard, modules: CompiledCard['modules']) {
    if (!sourceCard.files) {
      return;
    }

    let assetPaths = difference(Object.keys(sourceCard.files), getNonAssetFilePaths(sourceCard));

    for (const localModule of assetPaths) {
      if (!localModule) {
        continue;
      }

      let source = this.getFile(sourceCard, localModule);
      modules[localModule] = {
        type: getFileType(localModule),
        source,
      };
    }
  }

  private getCardParentPath(cardSource: NewRawCard, meta: PluginMeta): string | undefined {
    let parentPath;
    let { adoptsFrom, realm, id } = cardSource;

    if (adoptsFrom) {
      if (id != null && `${realm}${id}` === adoptsFrom) {
        throw new Error(`BUG: ${realm}${id} provides itself as its parent. That should not happen.`);
      }
      parentPath = cardSource.adoptsFrom;
    }

    if (meta.parent && meta.parent.cardURL) {
      if (parentPath && parentPath !== meta.parent.cardURL) {
        throw new Error(`card provides conflicting parent URLs in card.json and schema.js`);
      }
      parentPath = meta.parent.cardURL;
    }

    return parentPath;
  }

  private async getParentCard(cardSource: NewRawCard, meta: PluginMeta): Promise<CompiledCard> {
    let parentCardPath = this.getCardParentPath(cardSource, meta);
    let url = parentCardPath ? resolveCard(parentCardPath, cardSource.realm) : baseCardURL;
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

  private getFile(cardSource: NewRawCard, path: string): string {
    let fileSrc = cardSource.files && cardSource.files[path];
    if (!fileSrc) {
      throw new CardstackError(`card refers to ${path} in its card.json but that file does not exist`);
    }
    return fileSrc;
  }

  // returns the module name of our own compiled schema, if we have one. Does
  // not recurse into parent, because we don't necessarily know our parent until
  // after we've tried to compile our own
  private async prepareSchema(
    cardSource: NewRawCard,
    options: any,
    modules: CompiledCard['modules']
  ): Promise<LocalRef | undefined> {
    let schemaLocalFilePath = cardSource.schema;
    if (!schemaLocalFilePath) {
      if (cardSource.files && cardSource.files['schema.js']) {
        console.warn(`You did not specify what is your schema file, but a schema.js file exists. Using schema.js.`);
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

    modules[schemaLocalFilePath] = {
      type: JS_TYPE,
      source: out!.code!,
    };
    return { local: schemaLocalFilePath };
  }

  private async lookupFieldsForCard(metaFields: FieldsMeta, realm: string): Promise<CompiledCard['fields']> {
    let fields: CompiledCard['fields'] = {};
    for (let [name, { cardURL, type }] of Object.entries(metaFields)) {
      let fieldURL = resolveCard(cardURL, realm);
      try {
        fields[name] = {
          card: await this.builder.getCompiledCard(fieldURL),
          type,
          name,
        };
      } catch (err: any) {
        if (!err.isCardstackError || err.status !== 404) {
          throw err;
        }
        let newErr = new CardstackError(`tried to lookup field '${name}' but it failed to load`, {
          status: 422,
        });
        newErr.additionalErrors = [err, ...(err.additionalErrors || [])];
        throw newErr;
      }
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
    cardSource: NewRawCard,
    fields: CompiledCard['fields'],
    parentCard: CompiledCard | undefined,
    modules: CompiledCard['modules']
  ) {
    let components: Partial<Pick<CompiledCard<Unsaved, ModuleRef>, Format>> = {};
    for (const format of FORMATS) {
      components[format] = await this.prepareComponent(cardSource, fields, parentCard, format, modules);
    }
    return components as Pick<CompiledCard, Format>;
  }

  private async prepareComponent(
    cardSource: NewRawCard,
    fields: CompiledCard['fields'],
    parentCard: CompiledCard | undefined,
    which: Format,
    modules: CompiledCard['modules']
  ): Promise<ComponentInfo<ModuleRef>> {
    let localFilePath = cardSource[which];

    if (!localFilePath) {
      // we don't have an implementation of our own
      if (!parentCard) {
        throw new CardstackError(`card doesn't have a ${which} component OR a parent card. This is not right.`);
      }

      let componentInfo = parentCard[which];
      let inheritedFrom = componentInfo.inheritedFrom ?? parentCard.url;
      componentInfo = {
        ...componentInfo,
        inheritedFrom,
      };

      if (cardSource.schema) {
        // recompile parent component because we extend the schema
        let originalRawCard = await this.builder.getRawCard(inheritedFrom);
        let srcLocalPath = originalRawCard[which];
        if (!srcLocalPath) {
          throw new CardstackError(
            `bug: ${parentCard.url} says it got ${which} from ${inheritedFrom}, but that card does not have a ${which} component`
          );
        }
        let src = this.getFile(originalRawCard, srcLocalPath);
        let componentInfo = await this.compileComponent(
          src,
          fields,
          `${originalRawCard.realm}${originalRawCard.id}/${srcLocalPath}`,
          srcLocalPath,
          which,
          modules
        );
        componentInfo.inheritedFrom = inheritedFrom;
        return componentInfo;
      } else {
        // directly reuse existing parent component because we didn't extend
        // anything
        let componentInfo = parentCard[which];
        if (!componentInfo.inheritedFrom) {
          componentInfo = {
            ...componentInfo,
            inheritedFrom: parentCard.url,
          };
        }
        return componentInfo;
      }
    }

    let src = this.getFile(cardSource, localFilePath);
    return await this.compileComponent(
      src,
      fields,
      `${cardSource.realm}${cardSource.id ?? 'NEW_CARD'}/${localFilePath}`,
      localFilePath,
      which,
      modules
    );
  }

  private async compileComponent(
    templateSource: string,
    fields: CompiledCard['fields'],
    debugPath: string,
    localFile: string,
    format: Format,
    modules: CompiledCard['modules']
  ): Promise<ComponentInfo<LocalRef>> {
    let options: CardComponentPluginOptions = {
      debugPath,
      fields,
      inlineHBS: undefined,
      defaultFieldFormat: defaultFieldFormat(format),
      usedFields: [],
    };

    let code: string;
    code = transformCardComponent(templateSource, options);
    let moduleName = hashFilenameFromFields(localFile, fields);
    modules[moduleName] = {
      type: JS_TYPE,
      source: code,
    };
    let componentInfo: ComponentInfo<LocalRef> = {
      moduleName: { local: moduleName },
      usedFields: options.usedFields,
      inlineHBS: options.inlineHBS,
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

function isBaseCard(cardSource: NewRawCard): boolean {
  return cardSource.id === 'base' && cardSource.realm === 'https://cardstack.com/base/';
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

export function resolveCard(url: string, realm: string): string {
  let base = ensureTrailingSlash(realm) + 'PLACEHOLDER/';
  let resolved = new URL(url, base).href;
  if (resolved.startsWith(base)) {
    throw new CardstackError(`${url} resolves to a local file within a card, but it should resolve to a whole card`);
  }
  return resolved;
}

export function defineModules<Identity extends Saved | Unsaved>(
  card: CompiledCard<Identity, ModuleRef>,
  define: (localPath: string, type: string, source: string) => string
): CompiledCard<Identity, GlobalRef> {
  let localToGlobal = new Map<string, string>();

  for (let [localPath, { type, source }] of Object.entries(card.modules)) {
    let globalRef = define(localPath, type, source);
    localToGlobal.set(localPath, globalRef);
  }

  function ensureGlobal(ref: ModuleRef): GlobalRef {
    if ('global' in ref) {
      return ref;
    }
    let globalRef = localToGlobal.get(ref.local);
    if (!globalRef) {
      throw new Error(`bug: found to global ref for ${ref.local}`);
    }
    return { global: globalRef };
  }

  function ensureGlobalComponentInfo(info: ComponentInfo<ModuleRef>): ComponentInfo<GlobalRef> {
    return {
      moduleName: ensureGlobal(info.moduleName),
      usedFields: info.usedFields,
      inlineHBS: info.inlineHBS,
      inheritedFrom: info.inheritedFrom,
    };
  }

  return {
    url: card.url,
    realm: card.realm,
    adoptsFrom: card.adoptsFrom,
    fields: card.fields,
    schemaModule: ensureGlobal(card.schemaModule),
    serializer: card.serializer,
    isolated: ensureGlobalComponentInfo(card.isolated),
    embedded: ensureGlobalComponentInfo(card.embedded),
    edit: ensureGlobalComponentInfo(card.edit),
    modules: card.modules,
  };
}
