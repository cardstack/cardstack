import { JS_TYPE } from './utils/content';
import { BabelFileResult, transformFromAstSync } from '@babel/core';
import difference from 'lodash/difference';
import type { types as t } from '@babel/core';
import intersection from 'lodash/intersection';
import reduce from 'lodash/reduce';
import md5 from 'md5';

import analyzeSchemaBabelPlugin, { FieldsMeta, getMeta, PluginMeta } from './babel-plugin-card-schema-analyze';
import cardSchemaTransformPlugin from './babel-plugin-card-schema-transform';
import transformCardComponent, {
  CardComponentPluginOptions as CardComponentPluginOptions,
} from './babel-plugin-card-template';
import {
  Builder,
  CompiledCard,
  ComponentInfo,
  FEATURE_NAMES,
  Format,
  GlobalRef,
  LocalRef,
  ModuleRef,
  RawCard,
  RawCardData,
  Saved,
  Unsaved,
} from './interfaces';
import { ensureTrailingSlash, getBasenameAndExtension } from './utils';
import { getFileType } from './utils/content';
import { CardstackError, BadRequest, augmentBadRequest, isCardstackError } from './utils/errors';

export const baseCardURL = 'https://cardstack.com/base/base';

function getNonAssetFilePaths(sourceCard: RawCard<Unsaved>): (string | undefined)[] {
  let paths: string[] = [];
  for (const feature of FEATURE_NAMES) {
    paths.push(sourceCard[feature]);
  }
  return paths.filter(Boolean);
}

export class Compiler<Identity extends Saved | Unsaved = Saved> {
  private builder: TrackedBuilder;
  private cardSource: RawCard<Identity>;

  constructor(params: { builder: Builder; cardSource: RawCard<Identity> }) {
    this.builder = new TrackedBuilder(params.builder);
    this.cardSource = params.cardSource;
  }

  get dependencies(): Set<string> {
    return this.builder.dependencies;
  }

  async compile(): Promise<CompiledCard<Identity, ModuleRef>> {
    let options = {};
    let modules: CompiledCard<Unsaved, LocalRef>['modules'] = {};
    let { cardSource } = this;
    let schemaModule: ModuleRef | undefined = this.analyzeSchema(cardSource, options, modules);
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

      if (parentCard.url !== baseCardURL) {
        let isParentPrimitive = Object.keys(parentCard.fields).length === 0;
        if (isParentPrimitive && schemaModule) {
          throw new CardstackError(
            `Card ${cardSource.realm}${cardSource.id} adopting from primitive parent ${parentCard.url} must be of primitive type itself and should not have a schema.js file.`
          );
        }
      }

      if (schemaModule) {
        this.prepareSchema(schemaModule, meta, fields, parentCard, modules);
      } else {
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

    if (cardSource.data) {
      let unexpectedFields = difference(Object.keys(cardSource.data), Object.keys(fields));
      if (unexpectedFields.length) {
        throw new BadRequest(`Field(s) "${unexpectedFields.join(',')}" does not exist on this card`);
      }
    }

    return {
      realm: cardSource.realm,
      url: (cardSource.id ? `${cardSource.realm}${cardSource.id}` : undefined) as Identity,
      serializer,
      schemaModule,
      fields,
      adoptsFrom: parentCard,
      componentInfos: await this.prepareComponents(cardSource, fields, parentCard, modules),
      modules,
      deps: [...this.dependencies],
    };
  }

  private defineAssets(sourceCard: RawCard<Unsaved> | RawCard, modules: CompiledCard['modules']) {
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

  private getCardParentPath(cardSource: RawCard<Unsaved>, meta: PluginMeta): string | undefined {
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

  private async getParentCard(cardSource: RawCard<Unsaved>, meta: PluginMeta): Promise<CompiledCard> {
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

  private getFile(cardSource: RawCard<Unsaved>, path: string): string {
    let fileSrc = cardSource.files && cardSource.files[path];
    if (!fileSrc) {
      throw new CardstackError(`card refers to ${path} in its card.json but that file does not exist`);
    }
    return fileSrc;
  }

  // returns the module name of our own compiled schema, if we have one. Does
  // not recurse into parent, because we don't necessarily know our parent until
  // after we've tried to compile our own
  private analyzeSchema(
    cardSource: RawCard<Unsaved>,
    options: any,
    modules: CompiledCard<Unsaved, LocalRef>['modules']
  ): LocalRef | undefined {
    let schemaLocalFilePath = cardSource.schema;
    if (!schemaLocalFilePath) {
      if (cardSource.files && cardSource.files['schema.js']) {
        console.warn(`You did not specify what is your schema file, but a schema.js file exists. Using schema.js.`);
      }

      return undefined;
    }
    let schemaSrc = this.getFile(cardSource, schemaLocalFilePath);
    let { code, ast } = analyzeSchemaBabelPlugin(schemaSrc, options);

    modules[schemaLocalFilePath] = {
      type: JS_TYPE,
      source: code!,
      ast: ast!,
    };
    return { local: schemaLocalFilePath };
  }

  private prepareSchema(
    schemaModule: LocalRef,
    meta: PluginMeta,
    fields: CompiledCard['fields'],
    parent: CompiledCard,
    modules: CompiledCard<Unsaved, LocalRef>['modules']
  ) {
    let { source, ast } = modules[schemaModule.local];
    if (!ast) {
      throw new Error(`expecting an AST for ${schemaModule.local}, but none was generated`);
    }

    let out: BabelFileResult;
    try {
      out = transformFromAstSync(ast, source, {
        ast: true,
        plugins: [[cardSchemaTransformPlugin, { meta, fields, parent }]],
      })!;
    } catch (error: any) {
      throw augmentBadRequest(error);
    }
    modules[schemaModule.local] = {
      type: JS_TYPE,
      source: out!.code!,
      ast: out!.ast!,
    };
  }

  private async lookupFieldsForCard(metaFields: FieldsMeta, realm: string): Promise<CompiledCard['fields']> {
    let fields: CompiledCard['fields'] = {};
    for (let [name, { cardURL, type, computed }] of Object.entries(metaFields)) {
      let fieldURL = resolveCard(cardURL, realm);
      try {
        fields[name] = {
          card: await this.builder.getCompiledCard(fieldURL),
          type,
          name,
          computed,
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
    cardSource: RawCard<Unsaved>,
    fields: CompiledCard['fields'],
    parentCard: CompiledCard | undefined,
    modules: CompiledCard<Unsaved, LocalRef>['modules']
  ): Promise<CompiledCard<Unsaved, ModuleRef>['componentInfos']> {
    return {
      isolated: await this.prepareComponent(cardSource, fields, parentCard, 'isolated', modules),
      embedded: await this.prepareComponent(cardSource, fields, parentCard, 'embedded', modules),
      edit: await this.prepareComponent(cardSource, fields, parentCard, 'edit', modules),
    };
  }

  private async prepareComponent(
    cardSource: RawCard<Unsaved>,
    fields: CompiledCard['fields'],
    parentCard: CompiledCard | undefined,
    which: Format,
    modules: CompiledCard<Unsaved, LocalRef>['modules']
  ): Promise<ComponentInfo<ModuleRef>> {
    let localFilePath = cardSource[which];

    if (!localFilePath) {
      // we don't have an implementation of our own
      if (!parentCard) {
        throw new CardstackError(`card doesn't have a ${which} component OR a parent card. This is not right.`);
      }

      let componentInfo = parentCard.componentInfos[which];
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
        let componentInfo = parentCard.componentInfos[which];
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
    modules: CompiledCard<Unsaved, LocalRef>['modules']
  ): Promise<ComponentInfo<LocalRef>> {
    let options: CardComponentPluginOptions = {
      debugPath,
      fields,
      inlineHBS: undefined,
      defaultFieldFormat: defaultFieldFormat(format),
      usedFields: [],
      serializerMap: {},
    };

    let { source, ast } = transformCardComponent(templateSource, options);
    let moduleName = hashFilenameFromFields(localFile, fields);
    modules[moduleName] = {
      type: JS_TYPE,
      source,
      ast,
    };
    let componentInfo: ComponentInfo<LocalRef> = {
      moduleName: { local: moduleName },
      usedFields: options.usedFields,
      inlineHBS: options.inlineHBS,
      serializerMap: options.serializerMap,
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

function isBaseCard(cardSource: RawCard<Unsaved>): boolean {
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

export function makeGloballyAddressable(
  url: string,
  card: CompiledCard<Unsaved, ModuleRef>,
  define: (localPath: string, type: string, source: string, ast: t.File | undefined) => string
): CompiledCard<Saved, GlobalRef> {
  let localToGlobal = new Map<string, string>();

  for (let [localPath, { type, source, ast }] of Object.entries(card.modules)) {
    let globalRef = define(localPath, type, source, ast);
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
      serializerMap: info.serializerMap,
    };
  }

  return {
    url: url,
    realm: card.realm,
    adoptsFrom: card.adoptsFrom,
    fields: card.fields,
    schemaModule: ensureGlobal(card.schemaModule),
    serializer: card.serializer,
    componentInfos: {
      isolated: ensureGlobalComponentInfo(card.componentInfos.isolated),
      embedded: ensureGlobalComponentInfo(card.componentInfos.embedded),
      edit: ensureGlobalComponentInfo(card.componentInfos.edit),
    },
    modules: card.modules,
    deps: card.deps,
  };
}

export function generateSearchData(data: RawCardData, compiled: CompiledCard): Record<string, any> | null {
  let result: Record<string, any> = {};
  for (let fieldName of Object.keys(compiled.fields)) {
    let currentCard: CompiledCard | undefined = compiled;
    do {
      let entry = result[currentCard.url];
      if (!entry) {
        entry = result[currentCard.url] = {};
      }
      entry[fieldName] = data[fieldName];
      currentCard = currentCard.adoptsFrom;
    } while (currentCard && currentCard.fields[fieldName]);
  }

  return result;
}

class TrackedBuilder implements Builder {
  readonly dependencies = new Set<string>();
  constructor(private realBuilder: Builder) {}
  async getCompiledCard(url: string): Promise<CompiledCard> {
    this.dependencies.add(url);
    let card = await this.trapErrorDeps(() => this.realBuilder.getCompiledCard(url));
    for (let depUrl of card.deps) {
      this.dependencies.add(depUrl);
    }
    return card;
  }
  getRawCard(url: string): Promise<RawCard> {
    this.dependencies.add(url);
    return this.trapErrorDeps(() => this.realBuilder.getRawCard(url));
  }
  private async trapErrorDeps<Result>(fn: () => Promise<Result>): Promise<Result> {
    try {
      return await fn();
    } catch (err: any) {
      if (isCardstackError(err) && err.deps) {
        for (let url of err.deps) {
          this.dependencies.add(url);
        }
      }
      throw err;
    }
  }
}
