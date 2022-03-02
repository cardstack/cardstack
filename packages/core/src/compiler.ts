import { JS_TYPE } from './utils/content';
import { BabelFileResult, transformFromAstSync } from '@babel/core';
import difference from 'lodash/difference';
import type { types as t } from '@babel/core';
import intersection from 'lodash/intersection';
import isEqual from 'lodash/isEqual';
import differenceWith from 'lodash/differenceWith';

import analyzeFileBabelPlugin, { ExportMeta, FileMeta } from './babel-plugin-card-file-analyze';
import analyzeSchemaBabelPlugin, { FieldsMeta, getMeta, PluginMeta } from './babel-plugin-card-schema-analyze';
import cardSchemaTransformPlugin from './babel-plugin-card-schema-transform';
import generateComponentMeta, { CardComponentMetaPluginOptions } from './babel-plugin-card-component-meta';
import transformCardComponent, {
  CardComponentPluginOptions as CardComponentPluginOptions,
} from './babel-plugin-card-template';
import {
  Builder,
  CardId,
  CardModule,
  CompiledCard,
  ComponentInfo,
  FeatureFile,
  FEATURE_NAMES,
  Format,
  GlobalRef,
  LocalRef,
  ModuleRef,
  RawCard,
  Saved,
  Unsaved,
} from './interfaces';
import { cardURL, ensureTrailingSlash, getBasenameAndExtension } from './utils';
import { getFileType } from './utils/content';
import { CardstackError, BadRequest, augmentBadRequest, isCardstackError } from './utils/errors';
import { hashCardFields } from './utils/fields';

const BASE_CARD_ID: CardId = {
  realm: 'https://cardstack.com/base/',
  id: 'base',
};
export const BASE_CARD_URL = cardURL(BASE_CARD_ID);

export class Compiler<Identity extends Saved | Unsaved = Saved> {
  private builder: TrackedBuilder;
  private cardSource: RawCard<Identity>;

  private sourceModules: Record<
    string,
    CardModule & {
      meta?: FileMeta;
    }
  >;
  private globalModules: CompiledCard<Unsaved, LocalRef>['modules'];

  constructor(params: { builder: Builder; cardSource: RawCard<Identity> }) {
    this.builder = new TrackedBuilder(params.builder);
    this.cardSource = params.cardSource;
    this.sourceModules = {};
    this.globalModules = {};
  }

  get dependencies(): Set<string> {
    return this.builder.dependencies;
  }

  async compile(): Promise<CompiledCard<Identity, ModuleRef>> {
    let options = {};
    let { cardSource } = this;

    this.analyzeFiles();

    let schemaModule: ModuleRef | undefined = this.analyzeSchema(options);
    let meta = getMeta(options);

    let fields = await this.lookupFieldsForCard(meta.fields, cardSource.realm);

    let parentCard;

    if (isBaseCard(cardSource)) {
      schemaModule = { global: 'todo' };
    } else {
      parentCard = await this.getParentCard(meta);

      if (!parentCard) {
        throw new CardstackError(`Failed to find a parent card. This is wrong and should not happen.`);
      }

      if (parentCard.url !== BASE_CARD_URL) {
        let isParentPrimitive = Object.keys(parentCard.fields).length === 0;
        if (isParentPrimitive && schemaModule) {
          throw new CardstackError(
            `Card ${cardSource.realm}${cardSource.id} adopting from primitive parent ${parentCard.url} must be of primitive type itself and should not have a schema.js file.`
          );
        }
      }

      if (schemaModule) {
        this.prepareSchema(schemaModule, meta, fields, parentCard);
      } else {
        schemaModule = parentCard.schemaModule;
      }

      fields = this.adoptFields(fields, parentCard);
    }

    if (cardSource.data) {
      let unexpectedFields = difference(Object.keys(cardSource.data), Object.keys(fields));
      if (unexpectedFields.length) {
        throw new BadRequest(`Field(s) "${unexpectedFields.join(',')}" does not exist on this card`);
      }
    }

    let compiledCard = {
      realm: cardSource.realm,
      url: (cardSource.id ? `${cardSource.realm}${cardSource.id}` : undefined) as Identity,
      schemaModule,
      serializerModule: await this.getSerializer(parentCard),
      fields,
      adoptsFrom: parentCard,
      componentInfos: await this.prepareComponents(fields, parentCard),
      modules: this.globalModules,
      deps: [...this.dependencies],
    };

    return compiledCard;
  }

  private analyzeFiles() {
    for (const localPath in this.cardSource.files) {
      this.analyzeFile(localPath);
    }
  }

  private analyzeFile(localPath: string) {
    let { cardSource } = this;
    let source = this.getFile(cardSource, localPath);
    let feature = this.getFeatureForFilePath(localPath);

    if (feature === 'asset') {
      this.defineAsset(localPath, source);
      return;
    }

    let options = {};
    // TODO: Move schema analyze plugin into this one
    let { code, ast, meta } = analyzeFileBabelPlugin(source, options);

    this.sourceModules[localPath] = {
      type: JS_TYPE,
      source: code!,
      ast: ast!,
      meta,
    };
  }

  private defineAsset(localPath: string, source: string): void {
    this.globalModules[localPath] = {
      type: getFileType(localPath),
      source,
    };
  }

  private getFeatureForFilePath(localPath: string): FeatureFile {
    for (const feature of FEATURE_NAMES) {
      if (this.cardSource[feature] === localPath) {
        return feature;
      }
    }
    return 'asset';
  }

  private getCardParentPath(meta: PluginMeta): string | undefined {
    let parentPath;
    let { adoptsFrom, realm, id } = this.cardSource;

    if (adoptsFrom) {
      if (id != null && `${realm}${id}` === adoptsFrom) {
        throw new Error(`BUG: ${realm}${id} provides itself as its parent. That should not happen.`);
      }
      parentPath = adoptsFrom;
    }

    if (meta.parent && meta.parent.cardURL) {
      if (parentPath && parentPath !== meta.parent.cardURL) {
        throw new Error(`card provides conflicting parent URLs in card.json and schema.js`);
      }
      parentPath = meta.parent.cardURL;
    }

    return parentPath;
  }

  private async getParentCard(meta: PluginMeta): Promise<CompiledCard> {
    let { cardSource } = this;
    let parentCardPath = this.getCardParentPath(meta);
    let url = parentCardPath ? resolveCard(parentCardPath, cardSource.realm) : BASE_CARD_URL;
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
      throw new CardstackError(`card refers to ${path} in its card.json but that file does not exist`, { status: 422 });
    }
    return fileSrc;
  }

  private getSourceModule(localPath: string) {
    let module = this.sourceModules[localPath];
    if (!module) {
      throw new CardstackError(`card requested a module at '${localPath}' but it was not found`, {
        status: 422,
      });
    }
    return module;
  }

  // returns the module name of our own compiled schema, if we have one. Does
  // not recurse into parent, because we don't necessarily know our parent until
  // after we've tried to compile our own
  private analyzeSchema(options: any): LocalRef | undefined {
    let { cardSource } = this;
    let schemaLocalFilePath = cardSource.schema;
    if (!schemaLocalFilePath) {
      if (cardSource.files && cardSource.files['schema.js']) {
        console.warn(`You did not specify what is your schema file, but a schema.js file exists. Using schema.js.`);
      }

      return undefined;
    }
    let schemaSrc = this.getFile(cardSource, schemaLocalFilePath);
    let { code, ast } = analyzeSchemaBabelPlugin(schemaSrc, options);

    this.sourceModules[schemaLocalFilePath] = {
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
    parent: CompiledCard
  ) {
    let { source, ast } = this.getSourceModule(schemaModule.local);
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
    this.globalModules[schemaModule.local] = {
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
    fields: CompiledCard['fields'],
    parentCard: CompiledCard | undefined
  ): Promise<CompiledCard<Unsaved, ModuleRef>['componentInfos']> {
    return {
      isolated: await this.prepareComponent(fields, parentCard, 'isolated'),
      embedded: await this.prepareComponent(fields, parentCard, 'embedded'),
      edit: await this.prepareComponent(fields, parentCard, 'edit'),
    };
  }

  private async prepareComponent(
    fields: CompiledCard['fields'],
    parentCard: CompiledCard | undefined,
    which: Format
  ): Promise<ComponentInfo<ModuleRef>> {
    let { cardSource } = this;
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
          which
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

    let { source } = this.getSourceModule(localFilePath);
    return await this.compileComponent(
      source,
      fields,
      `${cardSource.realm}${cardSource.id ?? 'NEW_CARD'}/${localFilePath}`,
      localFilePath,
      which
    );
  }

  private async compileComponent(
    templateSource: string,
    fields: CompiledCard['fields'],
    debugPath: string,
    localFile: string,
    format: Format
  ): Promise<ComponentInfo<LocalRef>> {
    let fieldsHash = hashCardFields(fields);
    let componentModule = appendToFilename(localFile, '-' + fieldsHash);
    let metaModuleFileName = appendToFilename(componentModule, '__meta');

    let options: CardComponentPluginOptions = {
      debugPath,
      fields,
      metaModulePath: './' + metaModuleFileName,
      inlineHBS: undefined,
      defaultFieldFormat: defaultFieldFormat(format),
      usedFields: [],
    };

    let componentTransformResult = transformCardComponent(templateSource, options);
    this.globalModules[componentModule] = {
      type: JS_TYPE,
      source: componentTransformResult.source,
      ast: componentTransformResult.ast,
    };

    let metaOptions: CardComponentMetaPluginOptions = {
      debugPath: debugPath + '__meta',
      fields: options.fields,
      usedFields: options.usedFields,
      serializerMap: {},
    };
    let componentMetaResult = generateComponentMeta(metaOptions);
    this.globalModules[metaModuleFileName] = {
      type: JS_TYPE,
      source: componentMetaResult.source,
    };

    let componentInfo: ComponentInfo<LocalRef> = {
      componentModule: { local: componentModule },
      metaModule: { local: metaModuleFileName },
      usedFields: options.usedFields,
      inlineHBS: options.inlineHBS,
    };

    return componentInfo;
  }

  private async getSerializer(parentCard: CompiledCard | undefined): Promise<ModuleRef | undefined> {
    let serializerRef: ModuleRef | undefined;
    let { serializer } = this.cardSource;

    if (parentCard?.serializerModule) {
      if (serializer) {
        throw new CardstackError(
          `Your card declares a different deserializer than your parent. Thats not allowed. Card: ${serializer} Parent: ${parentCard.url}:${parentCard.serializerModule.global}`
        );
      }
      serializerRef = parentCard.serializerModule;
    } else if (serializer) {
      let serializerModule = this.getSourceModule(serializer);
      this.validateSerializer(serializerModule.meta);
      this.globalModules[serializer] = serializerModule;

      serializerRef = { local: serializer };
    }

    return serializerRef;
  }

  private validateSerializer(meta?: FileMeta) {
    const EXPECTED_EXPORTS: ExportMeta[] = [
      { name: 'serialize', type: 'FunctionDeclaration' },
      { name: 'deserialize', type: 'FunctionDeclaration' },
    ];
    let diff = differenceWith(EXPECTED_EXPORTS, meta?.exports || [], isEqual);
    if (diff.length) {
      throw new CardstackError(
        `Serializer is malformed. It is missing the following exports: ${diff.map((d) => d.name).join(', ')}`,
        { status: 422 }
      );
    }
  }
}

function appendToFilename(filename: string, toAppend: string): string {
  let { basename, extension } = getBasenameAndExtension(filename);
  return `${basename}${toAppend}${extension}`;
}

function isBaseCard(cardSource: RawCard<Unsaved>): boolean {
  return cardSource.id === BASE_CARD_ID.id && cardSource.realm === BASE_CARD_ID.realm;
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
    try {
      let globalRef = define(localPath, type, source, ast);
      localToGlobal.set(localPath, globalRef);
    } catch (error: any) {
      let newError = new CardstackError(`Failed to globally define module for path: ${localPath}`);
      newError.additionalErrors = [error];
      throw newError;
    }
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
      componentModule: ensureGlobal(info.componentModule),
      metaModule: ensureGlobal(info.metaModule),
      usedFields: info.usedFields,
      inlineHBS: info.inlineHBS,
      inheritedFrom: info.inheritedFrom,
    };
  }

  return {
    url: url,
    realm: card.realm,
    adoptsFrom: card.adoptsFrom,
    fields: card.fields,
    schemaModule: ensureGlobal(card.schemaModule),
    serializerModule: card.serializerModule ? ensureGlobal(card.serializerModule) : undefined,
    componentInfos: {
      isolated: ensureGlobalComponentInfo(card.componentInfos.isolated),
      embedded: ensureGlobalComponentInfo(card.componentInfos.embedded),
      edit: ensureGlobalComponentInfo(card.componentInfos.edit),
    },
    modules: card.modules,
    deps: card.deps,
  };
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
