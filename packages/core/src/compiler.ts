import { JS_TYPE } from './utils/content';
import { BabelFileResult, transformFromAstSync } from '@babel/core';
import difference from 'lodash/difference';
import type { types as t } from '@babel/core';
import intersection from 'lodash/intersection';
import isEqual from 'lodash/isEqual';
import isEmpty from 'lodash/isEmpty';
import differenceWith from 'lodash/differenceWith';

import analyzeCardModule, { ComponentMeta, ExportMeta, FileMeta } from './analyze';
import cardSchemaTransformPlugin, { Options } from './babel-plugin-card-schema-transform';
import transformCardComponent from './babel-plugin-card-template';
import {
  Builder,
  CardId,
  CardModules,
  CompiledCard,
  ComponentInfo,
  ComponentInfos,
  Field,
  Format,
  FORMATS,
  GlobalRef,
  LocalRef,
  ModuleRef,
  RawCard,
  Saved,
  Unsaved,
} from './interfaces';
import { cardURL, getCardAncestor, resolveCard, resolveModule } from './utils';
import { getFieldForPath } from './utils/fields';
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
  resolutionBase: string | undefined;
  inheritedFrom: string | undefined;
}

interface AssetModule {
  type: 'asset';
  mimeType: string;
  source: string;
}

type InputModules = Record<string, JSSourceModule | AssetModule>;

export type FieldWithPlaceholder = Omit<Field, 'card'> & { card: CompiledCard | 'self' };
export interface FieldsWithPlaceholders {
  [fieldName: string]: FieldWithPlaceholder;
}
type CompiledCardWithPlaceholders<Identity extends Unsaved = Saved, Ref extends ModuleRef = GlobalRef> = Omit<
  CompiledCard<Identity, Ref>,
  'fields'
> & { fields: FieldsWithPlaceholders };

type RecompiledComponents = Partial<Record<Format, string>>;

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
    let { cardSource } = this;
    let inputModules = this.analyzeFiles();
    let parentCard = await this.getParentCard(inputModules);

    let { modules, recompiledComponents, inheritedComponents } = await this.inheritComponents(parentCard);
    Object.assign(inputModules, modules);

    let fields = await this.lookupFieldsForCard(inputModules, parentCard);
    this.assertData(fields);

    let componentInfos = this.buildComponentInfos(inputModules, fields, recompiledComponents, inheritedComponents);
    let outputModules = await this.transformFiles(
      inputModules,
      recompiledComponents,
      fields,
      parentCard,
      componentInfos
    );

    let compiledCard = {
      realm: cardSource.realm,
      url: (cardSource.id ? `${cardSource.realm}${cardSource.id}` : undefined) as Identity,
      schemaModule: this.getSchemaModuleRef(parentCard, cardSource.schema),
      serializerModule: this.getSerializerModuleRef(parentCard, cardSource.serializer),
      fields,
      adoptsFrom: parentCard,
      componentInfos: componentInfos,
      modules: outputModules,
      deps: [...this.dependencies],
    };
    return this.resolveFieldsWithPlaceholders(compiledCard);
  }

  private assertData(fields: FieldsWithPlaceholders) {
    if (this.cardSource.data) {
      let unexpectedFields = difference(Object.keys(this.cardSource.data), Object.keys(fields));
      if (unexpectedFields.length) {
        throw new BadRequest(`Field(s) "${unexpectedFields.join(',')}" does not exist on this card`);
      }
    }
  }

  private resolveFieldsWithPlaceholders(
    enclosingCard: CompiledCardWithPlaceholders<Identity, ModuleRef> | CompiledCard<Identity, ModuleRef>,
    currentCard?: CompiledCardWithPlaceholders<Identity, ModuleRef> | CompiledCard<Identity, ModuleRef>
  ): CompiledCard<Identity, ModuleRef> {
    let fields: { [fieldName: string]: Field<Identity, ModuleRef> } = {};
    let card = currentCard ?? enclosingCard;
    for (let [fieldName, field] of Object.entries(card.fields)) {
      if (field.card === 'self') {
        fields[fieldName] = { ...field, card: enclosingCard as CompiledCard<Identity, ModuleRef> };
      } else {
        fields[fieldName] = {
          ...field,
          card: this.resolveFieldsWithPlaceholders(enclosingCard, field.card),
        };
      }
    }
    card.fields = fields;
    return card as CompiledCard<Identity, ModuleRef>;
  }

  private async inheritComponents(parentCard: CompiledCard | undefined) {
    let { cardSource } = this;
    let recompiledComponents: RecompiledComponents = {};
    let inheritedComponents: Partial<CompiledCard['componentInfos']> = {};
    let modules: InputModules = {};

    for (let format of FORMATS) {
      if (!cardSource[format]) {
        if (!parentCard) {
          throw new CardstackError(`bug: base card has no ${format} component`);
        }

        // recompile parent component because we extend the schema
        if (cardSource.schema) {
          // stick it into input modules so it will be recompiled
          let mod = await this.inheritParentComponent(parentCard, format);
          let name = uniqueName(cardSource.files, mod.localPath);
          modules[name] = mod;
          recompiledComponents[format] = name;
        } else {
          // directly reuse existing parent component because we didn't extend
          // anything
          let componentInfo = parentCard.componentInfos[format];
          if (!componentInfo.inheritedFrom) {
            componentInfo = {
              ...componentInfo,
              inheritedFrom: parentCard.url,
            };
          }
          inheritedComponents[format] = componentInfo;
        }
      }
    }
    return { modules, recompiledComponents, inheritedComponents };
  }

  buildComponentInfos(
    inputModules: InputModules,
    fields: FieldsWithPlaceholders,
    recompiledComponents: RecompiledComponents,
    inheritedComponents: Partial<Record<'isolated' | 'embedded' | 'edit', ComponentInfo<GlobalRef>>>
  ): ComponentInfos<LocalRef | GlobalRef> {
    let componentInfos: Partial<CompiledCard<Unsaved, LocalRef>['componentInfos']> = {};
    for (let format of FORMATS) {
      let localPath = recompiledComponents[format] ?? this.cardSource[format];
      if (!localPath) {
        continue;
      }
      let mod = inputModules[localPath];
      if (mod.type === 'asset' || !mod.meta.component) {
        throw new CardstackError(`Module that is supposed to be a component is not. Localpath: ${localPath}`);
      }
      componentInfos[format] = this.buildComponentInfo(mod, fields, mod.meta.component, defaultFieldFormat(format));
    }

    Object.assign(componentInfos, inheritedComponents);
    assertAllComponentInfos(componentInfos);
    return componentInfos;
  }

  buildComponentInfo(
    mod: JSSourceModule,
    fields: FieldsWithPlaceholders,
    meta: ComponentMeta,
    defaultFieldFormat: Format
  ): ComponentInfo<LocalRef> {
    let usedFields = buildUsedFieldsListFromUsageMeta(fields, defaultFieldFormat, meta.usage);
    let inlineHBS = canInlineHBS(meta.hasModifiedScope, meta.usage, fields, defaultFieldFormat)
      ? meta.rawHBS
      : undefined;

    return {
      componentModule: { local: mod.localPath },
      usedFields,
      inlineHBS,
      inheritedFrom: mod.inheritedFrom,
    };
  }

  private async transformFiles(
    inputModules: InputModules,
    recompiledComponents: RecompiledComponents,
    fields: FieldsWithPlaceholders,
    parentCard: CompiledCard | undefined,
    componentInfos: ComponentInfos
  ) {
    return Object.assign(
      {},
      ...Object.entries(inputModules).map(([localPath, mod]) =>
        this.transformFile(localPath, recompiledComponents, mod, fields, parentCard, componentInfos)
      )
    );
  }

  private transformFile(
    localPath: string,
    recompiledComponents: Record<string, string>,
    mod: JSSourceModule | AssetModule,
    fields: FieldsWithPlaceholders,
    parentCard: CompiledCard | undefined,
    componentInfos: ComponentInfos
  ): CompiledCard<Unsaved, LocalRef>['modules'] {
    let { cardSource } = this;
    if (mod.type === 'asset') {
      return {
        [localPath]: {
          type: mod.mimeType,
          source: mod.source,
        },
      };
    }

    if (localPath === cardSource.schema) {
      return {
        [localPath]: this.prepareSchema(mod, fields, parentCard, componentInfos),
      };
    }

    if (localPath === cardSource.serializer) {
      return {
        [localPath]: this.prepareSerializer(localPath, mod, parentCard),
      };
    }

    let formats = this.isComponentFile(localPath, recompiledComponents);
    if (formats) {
      let formatsMod: CardModules[] = [];
      // The same component file can be used for multiple views
      for (const format of formats) {
        let modules = this.compileComponent(mod, fields, format);
        formatsMod.push(modules);
      }
      return Object.assign({}, ...formatsMod);
    }

    return {
      [localPath]: {
        type: JS_TYPE,
        source: mod.source,
        ast: mod.ast,
      },
    };
  }

  private isComponentFile(localPath: string, recompiledComponents: Record<string, string>): Format[] | undefined {
    let formats: Format[] = [];
    for (let format of FORMATS) {
      if (localPath === this.cardSource[format] || localPath === recompiledComponents[format]) {
        formats.push(format);
      }
    }
    return formats.length ? formats : undefined;
  }

  private analyzeFiles() {
    let inputModules: InputModules = {};
    let { cardSource } = this;
    for (const localPath in this.cardSource.files) {
      inputModules[localPath] = this.analyzeFile(cardSource, localPath);
    }
    return inputModules;
  }

  private analyzeFile(rawCard: RawCard<Saved | Unsaved>, localPath: string): JSSourceModule | AssetModule {
    let source = this.getSourceFile(rawCard, localPath);

    if (!localPath.endsWith('.js')) {
      return {
        type: 'asset',
        mimeType: getFileType(localPath),
        source,
      };
    } else {
      let { code, ast, meta } = analyzeCardModule(
        source,
        debugPath(this.cardSource.realm, this.cardSource.id, localPath)
      );

      return {
        type: 'js',
        source: code!,
        ast: ast!,
        meta,
        localPath,
        resolutionBase: undefined,
        inheritedFrom: undefined,
      };
    }
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

  private async getParentCard(inputModules: InputModules): Promise<CompiledCard | undefined> {
    if (isBaseCard(this.cardSource)) {
      return undefined;
    }

    let localSchema: JSSourceModule | undefined;
    if (this.cardSource.schema) {
      localSchema = this.getSourceModule(inputModules, this.cardSource.schema);
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

  private getSourceModule(inputModules: InputModules, localPath: string): JSSourceModule {
    let module = inputModules[localPath];
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

  private prepareSchema(
    schemaModule: JSSourceModule,
    fields: FieldsWithPlaceholders,
    parent: CompiledCard | undefined,
    componentInfos: ComponentInfos
  ) {
    let { source, ast, meta } = schemaModule;
    let out: BabelFileResult;
    let opts: Options = { meta, fields, parent, componentInfos };
    try {
      out = transformFromAstSync(ast, source, {
        ast: true,
        plugins: [[cardSchemaTransformPlugin, opts]],
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

  private async lookupFieldsForCard(
    inputModules: InputModules,
    parentCard: CompiledCard | undefined
  ): Promise<FieldsWithPlaceholders> {
    let { realm, schema } = this.cardSource;
    let fields: FieldsWithPlaceholders = {};
    if (schema) {
      let metaFields = this.getSourceModule(inputModules, schema).meta.fields;
      for (let [name, { cardURL, type, computed }] of Object.entries(metaFields)) {
        let fieldURL = cardURL === '.' ? '.' : resolveCard(cardURL, realm);
        try {
          fields[name] = {
            card: fieldURL === '.' ? 'self' : await this.builder.getCompiledCard(fieldURL),
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
    }
    return this.adoptFields(fields, parentCard);
  }

  private adoptFields(fields: FieldsWithPlaceholders, parentCard: CompiledCard | undefined): FieldsWithPlaceholders {
    if (!parentCard) {
      return fields;
    }
    let cardFieldNames = Object.keys(fields);
    let parentFieldNames = Object.keys(parentCard.fields);
    let fieldNameCollisions = intersection(cardFieldNames, parentFieldNames);

    if (fieldNameCollisions.length) {
      throw new CardstackError(`Field collision on ${fieldNameCollisions.join()} with parent card ${parentCard.url}`);
    }

    return Object.assign({}, parentCard.fields, fields);
  }

  private async inheritParentComponent(parentCard: CompiledCard<string, GlobalRef>, which: Format) {
    let inheritedFrom = parentCard.componentInfos[which].inheritedFrom ?? parentCard.url;
    let originalRawCard = await this.builder.getRawCard(inheritedFrom);
    let srcLocalPath = originalRawCard[which];
    if (!srcLocalPath) {
      throw new CardstackError(
        `bug: ${parentCard.url} says ${inheritedFrom} should supply its '${which}' component, but that card does not have it`
      );
    }
    let mod = this.analyzeFile(originalRawCard, srcLocalPath);
    if (mod.type !== 'js') {
      throw new CardstackError(`bug: expected inherited component to be javascript`);
    }
    let componentOwner = getCardAncestor(parentCard, inheritedFrom);
    mod.resolutionBase = componentOwner.componentInfos[which].componentModule.global;
    mod.inheritedFrom = inheritedFrom;
    return mod;
  }

  private buildResolver(mod: JSSourceModule) {
    if (mod.resolutionBase) {
      let base = mod.resolutionBase;
      return (importPath: string): string => {
        return resolveModule(importPath, base);
      };
    } else {
      return (importPath: string) => importPath;
    }
  }

  private compileComponent(
    mod: JSSourceModule,
    fields: FieldsWithPlaceholders,
    format: Format
  ): CompiledCard<Unsaved, LocalRef>['modules'] {
    let componentTransformResult = transformCardComponent({
      ast: mod.ast,
      templateSource: mod.source,
      meta: mod.meta.component!,
      debugPath: debugPath(this.cardSource.realm, this.cardSource.id, mod.localPath),
      fields,
      defaultFieldFormat: defaultFieldFormat(format),
      resolveImport: this.buildResolver(mod),
    });

    return {
      [mod.localPath]: {
        type: JS_TYPE,
        source: componentTransformResult.source,
        ast: componentTransformResult.ast,
      },
    };
  }

  private prepareSerializer(
    serializerPath: string,
    serializerModule: JSSourceModule,
    parentCard: CompiledCard | undefined
  ) {
    if (parentCard?.serializerModule) {
      throw new CardstackError(
        `Your card declares a different deserializer than your parent. Thats not allowed. Card: ${serializerPath} Parent: ${parentCard.url}:${parentCard.serializerModule.global}`
      );
    }
    this.validateSerializer(serializerModule.meta);
    return {
      type: JS_TYPE,
      source: serializerModule.source,
      ast: serializerModule.ast,
    };
  }

  private getSchemaModuleRef(parentCard: CompiledCard | undefined, schemaPath: string | undefined): ModuleRef {
    if (schemaPath) {
      return { local: schemaPath };
    } else if (parentCard?.schemaModule) {
      return parentCard.schemaModule;
    }
    throw new CardstackError("Could not create a moduleRef for a card's schema");
  }

  private getSerializerModuleRef(
    parentCard: CompiledCard | undefined,
    serializerPath: string | undefined
  ): ModuleRef | undefined {
    if (parentCard?.serializerModule) {
      return parentCard.serializerModule;
    } else if (serializerPath) {
      return { local: serializerPath };
    }

    return;
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
      throw new CardstackError(`bug: card declared '${ref.local}' but there is no module to declare`, { status: 422 });
    }
    return { global: globalRef };
  }

  function ensureGlobalComponentInfo(info: ComponentInfo<ModuleRef>): ComponentInfo<GlobalRef> {
    return {
      componentModule: ensureGlobal(info.componentModule),
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

function uniqueName(files: RawCard['files'], desiredName: string) {
  if (!files?.[desiredName]) {
    return desiredName;
  }
  let counter = 0;
  while (true) {
    let name = desiredName + counter;
    if (!files[name]) {
      return name;
    }
    counter++;
  }
}

// TODO this will go away when we stop passing componentInfos via side effect
function assertAllComponentInfos(
  infos: Partial<CompiledCard<Unsaved, ModuleRef>['componentInfos']>
): asserts infos is CompiledCard<Unsaved, ModuleRef>['componentInfos'] {
  if (FORMATS.some((f) => !infos[f])) {
    throw new CardstackError(`bug: we're missing a component info`);
  }
}

function debugPath(realm: string, id: string | undefined, localPath: string): string {
  return `${realm}${id ?? 'NEW_CARD'}/${localPath}`;
}

function buildUsedFieldsListFromUsageMeta(
  fields: FieldsWithPlaceholders,
  defaultFieldFormat: Format,
  meta: ComponentMeta['usage']
): ComponentInfo['usedFields'] {
  let usedFields: Set<string> = new Set();

  if (meta.model && meta.model !== 'self') {
    for (const fieldPath of meta.model) {
      usedFields.add(fieldPath);
    }
  }

  if (meta.fields === 'self') {
    usedFields = new Set([...usedFields, ...Object.keys(fields)]);
  } else {
    for (const [fieldPath, fieldFormat] of meta.fields.entries()) {
      buildUsedFieldListFromComponents(
        usedFields,
        fieldPath,
        fields,
        fieldFormat === 'default' ? defaultFieldFormat : fieldFormat
      );
    }
  }

  return [...usedFields];
}

function buildUsedFieldListFromComponents(
  usedFields: Set<string>,
  fieldPath: string,
  fields: FieldsWithPlaceholders,
  format: Format,
  prefix?: string
): void {
  let field = getFieldForPath(fields, fieldPath);

  if (field && field.card !== 'self' && field.card.componentInfos[format].usedFields.length) {
    for (const nestedFieldPath of field.card.componentInfos[format].usedFields) {
      buildUsedFieldListFromComponents(usedFields, nestedFieldPath, field.card.fields, 'embedded', fieldPath);
    }
  } else {
    if (prefix) {
      usedFields.add(`${prefix}.${fieldPath}`);
    } else {
      usedFields.add(fieldPath);
    }
  }
}

function canInlineHBS(
  hasModifiedScope: boolean,
  meta: ComponentMeta['usage'],
  fields: FieldsWithPlaceholders,
  defaultFieldFormat: Format
): boolean {
  if (hasModifiedScope) {
    return false;
  }

  if (isEmpty(fields)) {
    return true;
  }

  let fieldsToInspect: [string, Format | 'default'][];
  if (meta.fields === 'self') {
    fieldsToInspect = Object.keys(fields).map((path) => [path, defaultFieldFormat]);
  } else {
    fieldsToInspect = [...meta.fields.entries()];
  }

  // If every field this card uses is inlinable, then this card can be inlined as well
  return fieldsToInspect.every(([path, format]) => {
    let field = getFieldForPath(fields, path);
    let actualFormat: Format = format === 'default' ? defaultFieldFormat : format;
    return field && field.card !== 'self' && !!field?.card.componentInfos[actualFormat].inlineHBS;
  });
}
