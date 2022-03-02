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
  CardModule,
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
import { cardURL, ensureTrailingSlash, getBasenameAndExtension } from './utils';
import { getFileType } from './utils/content';
import { CardstackError, BadRequest, augmentBadRequest, isCardstackError } from './utils/errors';
import { hashCardFields } from './utils/fields';

const BASE_CARD_ID: CardId = {
  realm: 'https://cardstack.com/base/',
  id: 'base',
};
export const BASE_CARD_URL = cardURL(BASE_CARD_ID);

type SourceCardModule = Required<CardModule> & {
  meta: FileMeta;
  localPath: string;
};
export class Compiler<Identity extends Saved | Unsaved = Saved> {
  private builder: TrackedBuilder;
  private cardSource: RawCard<Identity>;

  private schemaSourceModule: SourceCardModule | undefined;

  private originalModules: Record<string, SourceCardModule>;
  private outputModules: CompiledCard<Unsaved, LocalRef>['modules'];

  constructor(params: { builder: Builder; cardSource: RawCard<Identity> }) {
    this.builder = new TrackedBuilder(params.builder);
    this.cardSource = params.cardSource;
    this.originalModules = {};
    this.outputModules = {};
  }

  get dependencies(): Set<string> {
    return this.builder.dependencies;
  }

  async compile(): Promise<CompiledCard<Identity, ModuleRef>> {
    let { cardSource } = this;

    for (const localPath in this.cardSource.files) {
      this.analyzeFile(localPath);
    }

    let parentCard: CompiledCard | undefined;
    let fields: CompiledCard['fields'] = {};
    let schemaModuleRef: ModuleRef | undefined;

    this.schemaSourceModule = this.getLocalSchema();

    if (isBaseCard(cardSource)) {
      schemaModuleRef = { global: 'todo' };
    } else {
      parentCard = await this.getParentCard();

      if (this.schemaSourceModule) {
        fields = await this.lookupFieldsForCard();
        schemaModuleRef = this.prepareSchema(this.schemaSourceModule, fields, parentCard);
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

    let compiledCard = {
      realm: cardSource.realm,
      url: (cardSource.id ? `${cardSource.realm}${cardSource.id}` : undefined) as Identity,
      schemaModule: schemaModuleRef,
      serializerModule: await this.getSerializer(parentCard),
      fields,
      adoptsFrom: parentCard,
      componentInfos: await this.prepareComponents(fields, parentCard),
      modules: this.outputModules,
      deps: [...this.dependencies],
    };

    return compiledCard;
  }

  private analyzeFile(localPath: string) {
    let { cardSource } = this;
    let source = this.getSourceFile(cardSource, localPath);

    if (!localPath.endsWith('.js')) {
      this.defineAsset(localPath, source);
      return;
    }

    let options = {};
    let { code, ast, meta } = analyzeFileBabelPlugin(source, options);

    this.originalModules[localPath] = {
      type: JS_TYPE,
      source: code!,
      ast: ast!,
      meta,
      localPath,
    };
  }

  private defineAsset(localPath: string, source: string): void {
    this.outputModules[localPath] = {
      type: getFileType(localPath),
      source,
    };
  }

  private getCardParentURL(): string {
    let parentPath;
    let { adoptsFrom, realm, id } = this.cardSource;
    let parentMeta = this.schemaSourceModule?.meta.parent;

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

  private async getParentCard(): Promise<CompiledCard> {
    let url = this.getCardParentURL();
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
      if (isParentPrimitive && this.schemaSourceModule) {
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

  private getSourceModule(localPath: string) {
    let module = this.originalModules[localPath];
    if (!module) {
      throw new CardstackError(`card requested a module at '${localPath}' but it was not found`, {
        status: 422,
      });
    }
    return module;
  }

  private getLocalSchema() {
    let { cardSource } = this;
    let schemaLocalFilePath = cardSource.schema;
    if (!schemaLocalFilePath) {
      if (cardSource.files && cardSource.files['schema.js']) {
        console.warn(`You did not specify what is your schema file, but a schema.js file exists. Using schema.js.`);
        return this.getSourceModule('schema.js');
      }

      return undefined;
    }
    return this.getSourceModule(schemaLocalFilePath);
  }

  private prepareSchema(schemaModule: SourceCardModule, fields: CompiledCard['fields'], parent: CompiledCard) {
    let { source, ast, meta, localPath } = schemaModule;
    if (!ast) {
      throw new Error(`expecting an AST for ${localPath}, but none was generated`);
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
    this.outputModules[localPath] = {
      type: JS_TYPE,
      source: out!.code!,
      ast: out!.ast!,
    };
    return { local: localPath };
  }

  private async lookupFieldsForCard(): Promise<CompiledCard['fields']> {
    let { realm } = this.cardSource;
    let metaFields = this.schemaSourceModule?.meta.fields;

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
        let src = this.getSourceFile(originalRawCard, srcLocalPath);
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
    this.outputModules[componentModule] = {
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
      this.outputModules[serializer] = serializerModule;

      serializerRef = { local: serializer };
    }

    return serializerRef;
  }

  private validateSerializer(meta?: FileMeta) {
    const EXPECTED_EXPORTS: ExportMeta[] = [
      { type: 'declaration', name: 'serialize', declarationType: 'FunctionDeclaration' },
      { type: 'declaration', name: 'deserialize', declarationType: 'FunctionDeclaration' },
    ];
    let diff = differenceWith(EXPECTED_EXPORTS, meta?.exports || [], isEqual);
    if (diff.length) {
      let names = diff.map((d) => (d.type === 'declaration' ? d.name : null)).filter(Boolean);
      throw new CardstackError(`Serializer is malformed. It is missing the following exports: ${names.join(', ')}`, {
        status: 422,
      });
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
