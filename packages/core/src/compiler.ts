import { JS_TYPE } from './utils/content';
import { BabelFileResult, transformFromAstSync } from '@babel/core';
import difference from 'lodash/difference';
import type { types as t } from '@babel/core';
import intersection from 'lodash/intersection';
import isEqual from 'lodash/isEqual';
import differenceWith from 'lodash/differenceWith';

import analyzeFileBabelPlugin, { ExportMeta, FileMeta } from './babel-plugin-card-file-analyze';
import cardSchemaTransformPlugin from './babel-plugin-card-schema-transform';
import generateComponentMeta, { CardComponentMetaPluginOptions } from './babel-plugin-card-component-meta';
import transformCardComponent, {
  CardComponentPluginOptions as CardComponentPluginOptions,
} from './babel-plugin-card-template';
import {
  Builder,
  CardId,
  CompiledCard,
  ComponentInfo,
  Format,
  GlobalRef,
  LocalRef,
  ModuleRef,
  RawCard,
  Saved,
  Unsaved,
} from './interfaces';
import { cardURL, getBasenameAndExtension, getCardAncestor, resolveCard, resolveModule } from './utils';
import { getFileType } from './utils/content';
import { CardstackError, BadRequest, augmentBadRequest, isCardstackError } from './utils/errors';

const BASE_CARD_ID: CardId = {
  realm: 'https://cardstack.com/base/',
  id: 'base',
};
export const BASE_CARD_URL = cardURL(BASE_CARD_ID);

interface JSSourceModule {
  type: 'js';
  source: string;
  meta: FileMeta;
  ast: t.File;
  localPath: string;
}

interface AssetModule {
  type: 'asset';
  mimeType: string;
  source: string;
}

type OriginalModules = Record<string, JSSourceModule | AssetModule>;

export class Compiler<Identity extends Saved | Unsaved = Saved> {
  private builder: TrackedBuilder;
  private cardSource: RawCard<Identity>;

  private outputModules: CompiledCard<Unsaved, LocalRef>['modules'];

  constructor(params: { builder: Builder; cardSource: RawCard<Identity> }) {
    this.builder = new TrackedBuilder(params.builder);
    this.cardSource = params.cardSource;
    this.outputModules = {};
  }

  get dependencies(): Set<string> {
    return this.builder.dependencies;
  }

  async compile(): Promise<CompiledCard<Identity, ModuleRef>> {
    let { cardSource } = this;
    let originalModules = this.analyzeFiles();

    let parentCard: CompiledCard | undefined;
    let fields: CompiledCard['fields'] = {};
    let schemaModuleRef: ModuleRef | undefined;

    if (isBaseCard(cardSource)) {
      schemaModuleRef = { global: 'todo' };
    } else {
      parentCard = await this.getParentCard(originalModules);

      if (this.cardSource.schema) {
        let schemaSource = this.getSourceModule(originalModules, this.cardSource.schema);
        fields = await this.lookupFieldsForCard(schemaSource);
        this.outputModules[this.cardSource.schema] = this.prepareSchema(schemaSource, fields, parentCard);
        schemaModuleRef = { local: this.cardSource.schema };
      } else {
        schemaModuleRef = parentCard.schemaModule;
      }

      fields = this.adoptFields(fields, parentCard);
    }

    if (cardSource.data) {
      let unexpectedFields = difference(Object.keys(cardSource.data), Object.keys(fields));
      if (unexpectedFields.length) {
        throw new BadRequest(`Field(s) "${unexpectedFields.join(',')}" does not exist on this card`);
      }
    }

    for (let [localPath, mod] of Object.entries(originalModules)) {
      if (mod.type === 'asset') {
        this.outputModules[localPath] = {
          type: mod.mimeType,
          source: mod.source,
        };
      }
    }

    let compiledCard = {
      realm: cardSource.realm,
      url: (cardSource.id ? `${cardSource.realm}${cardSource.id}` : undefined) as Identity,
      schemaModule: schemaModuleRef,
      serializerModule: await this.getSerializer(originalModules, parentCard),
      fields,
      adoptsFrom: parentCard,
      componentInfos: await this.prepareComponents(originalModules, fields, parentCard),
      modules: this.outputModules,
      deps: [...this.dependencies],
    };

    return compiledCard;
  }

  private analyzeFiles() {
    let originalModules: OriginalModules = {};
    let { cardSource } = this;
    for (const localPath in this.cardSource.files) {
      let source = this.getSourceFile(cardSource, localPath);

      if (!localPath.endsWith('.js')) {
        originalModules[localPath] = {
          type: 'asset',
          mimeType: getFileType(localPath),
          source,
        };
      } else {
        let { code, ast, meta } = analyzeFileBabelPlugin(source);

        originalModules[localPath] = {
          type: 'js',
          source: code!,
          ast: ast!,
          meta,
          localPath,
        };
      }
    }
    return originalModules;
  }

  private getCardParentURL(localSchema: JSSourceModule | undefined): string {
    let parentPath;
    let { adoptsFrom, realm, id } = this.cardSource;
    let parentMeta = localSchema?.meta.parent;

    if (adoptsFrom) {
      if (id != null && `${realm}${id}` === adoptsFrom) {
        throw new Error(`BUG: ${realm}${id} provides itself as its parent. That should not happen.`);
      }
      parentPath = adoptsFrom;
    }

    if (parentMeta && parentMeta.cardURL) {
      if (parentPath && parentPath !== parentMeta.cardURL) {
        throw new Error(`card provides conflicting parent URLs in card.json and schema.js`);
      }
      parentPath = parentMeta.cardURL;
    }

    if (parentPath) {
      return resolveCard(parentPath, realm);
    } else {
      return BASE_CARD_URL;
    }
  }

  private async getParentCard(originalModules: OriginalModules): Promise<CompiledCard> {
    let localSchema: JSSourceModule | undefined;
    if (this.cardSource.schema) {
      localSchema = this.getSourceModule(originalModules, this.cardSource.schema);
    }
    let url = this.getCardParentURL(localSchema);
    let parentCard: CompiledCard;
    try {
      parentCard = await this.builder.getCompiledCard(url);
    } catch (err: any) {
      if (!err.isCardstackError || err.status !== 404) {
        throw err;
      }
      let newErr = new CardstackError(`tried to adopt from card ${url} but it failed to load`, { status: 422 });
      newErr.additionalErrors = [err, ...(err.additionalErrors || [])];
      throw newErr;
    }

    if (!parentCard) {
      throw new CardstackError(`Failed to find a parent card. This is wrong and should not happen.`);
    }

    if (parentCard.url !== BASE_CARD_URL) {
      let isParentPrimitive = Object.keys(parentCard.fields).length === 0;
      if (isParentPrimitive && localSchema) {
        throw new CardstackError(
          `Card ${this.cardSource.realm}${this.cardSource.id} adopting from primitive parent ${parentCard.url} must be of primitive type itself and should not have a schema.js file.`
        );
      }
    }

    return parentCard;
  }

  private getSourceFile(cardSource: RawCard<Unsaved>, path: string): string {
    let fileSrc = cardSource.files && cardSource.files[path];
    if (!fileSrc) {
      throw new CardstackError(`card refers to ${path} in its card.json but that file does not exist`, { status: 422 });
    }
    return fileSrc;
  }

  private getSourceModule(originalModules: OriginalModules, localPath: string): JSSourceModule {
    let module = originalModules[localPath];
    if (!module) {
      throw new CardstackError(`card requested a module at '${localPath}' but it was not found`, {
        status: 422,
      });
    }
    if (module.type !== 'js') {
      throw new CardstackError(
        `card requested a javascript module at '${localPath}' but found type ${module.mimeType}`
      );
    }
    return module;
  }

  private prepareSchema(schemaModule: JSSourceModule, fields: CompiledCard['fields'], parent: CompiledCard) {
    let { source, ast, meta } = schemaModule;
    let out: BabelFileResult;
    try {
      out = transformFromAstSync(ast, source, {
        ast: true,
        plugins: [[cardSchemaTransformPlugin, { meta, fields, parent }]],
      })!;
    } catch (error: any) {
      throw augmentBadRequest(error);
    }
    return {
      type: JS_TYPE,
      source: out!.code!,
      ast: out!.ast!,
    };
  }

  private async lookupFieldsForCard(localSchema: JSSourceModule): Promise<CompiledCard['fields']> {
    let { realm } = this.cardSource;
    let metaFields = localSchema.meta.fields;

    if (!metaFields) {
      return {};
    }
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
    originalModules: OriginalModules,
    fields: CompiledCard['fields'],
    parentCard: CompiledCard | undefined
  ): Promise<CompiledCard<Unsaved, ModuleRef>['componentInfos']> {
    return {
      isolated: await this.prepareComponent(originalModules, fields, parentCard, 'isolated'),
      embedded: await this.prepareComponent(originalModules, fields, parentCard, 'embedded'),
      edit: await this.prepareComponent(originalModules, fields, parentCard, 'edit'),
    };
  }

  private async prepareComponent(
    originalModules: OriginalModules,
    fields: CompiledCard['fields'],
    parentCard: CompiledCard | undefined,
    which: Format
  ): Promise<ComponentInfo<ModuleRef>> {
    let { cardSource } = this;
    let localFilePath = cardSource[which];

    if (localFilePath) {
      let { source } = this.getSourceModule(originalModules, localFilePath);
      return await this.compileComponent(
        source,
        fields,
        `${cardSource.realm}${cardSource.id ?? 'NEW_CARD'}/${localFilePath}`,
        localFilePath,
        which
      );
    }

    // we don't have an implementation of our own
    if (!parentCard) {
      throw new CardstackError(`card doesn't have a ${which} component OR a parent card. This is not right.`);
    }

    // recompile parent component because we extend the schema
    if (cardSource.schema) {
      return await this.recompileComponentFromParent(parentCard, which, fields);
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

  private async recompileComponentFromParent(
    parentCard: CompiledCard<string, GlobalRef>,
    which: Format,
    fields: CompiledCard['fields']
  ): Promise<ComponentInfo<ModuleRef>> {
    let inheritedFrom = parentCard.componentInfos[which].inheritedFrom ?? parentCard.url;

    // TODO: Fetch inheritedFrom component format module ref
    let originalRawCard = await this.builder.getRawCard(inheritedFrom);
    let srcLocalPath = originalRawCard[which];
    if (!srcLocalPath) {
      throw new CardstackError(
        `bug: ${parentCard.url} says ${inheritedFrom} should supply its '${which}' component, but that card does not have it`
      );
    }

    let componentOwner = getCardAncestor(parentCard, inheritedFrom);

    let src = this.getSourceFile(originalRawCard, srcLocalPath);
    // Pass in inheritedFrom to module path to plugin and to the babel plugin
    let componentInfo = await this.compileComponent(
      src,
      fields,
      `${originalRawCard.realm}${originalRawCard.id}/${srcLocalPath}`,
      srcLocalPath,
      which,
      componentOwner.componentInfos[which].componentModule
    );
    componentInfo.inheritedFrom = inheritedFrom;
    return componentInfo;
  }

  private async compileComponent(
    templateSource: string,
    fields: CompiledCard['fields'],
    debugPath: string,
    localFile: string,
    format: Format,
    parentComponentRef?: GlobalRef
  ): Promise<ComponentInfo<LocalRef>> {
    let metaModuleFileName = appendToFilename(localFile, '__meta');

    let options: CardComponentPluginOptions = {
      debugPath,
      fields,
      metaModulePath: './' + metaModuleFileName,
      inlineHBS: undefined,
      defaultFieldFormat: defaultFieldFormat(format),
      usedFields: [],
    };

    if (parentComponentRef) {
      options.resolveImport = (importPath: string): string => {
        return resolveModule(importPath, parentComponentRef.global);
      };
    }

    let componentTransformResult = transformCardComponent(templateSource, options);
    this.outputModules[localFile] = {
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
    this.outputModules[metaModuleFileName] = {
      type: JS_TYPE,
      source: componentMetaResult.source,
    };

    let componentInfo: ComponentInfo<LocalRef> = {
      componentModule: { local: localFile },
      metaModule: { local: metaModuleFileName },
      usedFields: options.usedFields,
      inlineHBS: options.inlineHBS,
    };

    return componentInfo;
  }

  private async getSerializer(
    originalModules: OriginalModules,
    parentCard: CompiledCard | undefined
  ): Promise<ModuleRef | undefined> {
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
      let serializerModule = this.getSourceModule(originalModules, serializer);
      this.validateSerializer(serializerModule.meta);
      this.outputModules[serializer] = {
        type: JS_TYPE,
        source: serializerModule.source,
        ast: serializerModule.ast,
      };

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
