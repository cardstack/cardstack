import * as JSON from 'json-typescript';
import { CardstackError } from './utils/errors';
import type { types as t } from '@babel/core';
import { cardURL, keys } from './utils';
import { Query } from './query';
import type CardModel from './card-model';

export { Query } from './query';

const componentFormats = {
  isolated: '',
  embedded: '',
  edit: '',
};
export type Format = keyof typeof componentFormats;
export const FORMATS = keys(componentFormats);
export type { CardModel };

export function isFormat(s: any): s is Format {
  return s && s in componentFormats;
}

const featureNamesMap = {
  schema: '',
  serializer: '',
};
export type FeatureFile = keyof typeof featureNamesMap | Format | 'asset';
export const FEATURE_NAMES = [...keys(featureNamesMap), ...FORMATS];

export interface PrimitiveSerializer {
  serialize(val: any): any;
  deserialize(val: any): any;
}

export type CardData = Record<string, any>;

export type Setter = (value: any) => void;

export interface CardId {
  realm: string;
  id: string;
}

export type RawCardData = Record<string, any>;
// RawCard represents the card "as authored". Nothing is preprocessed or
// compiled, no other dependent data is included, no derived state is present.
export interface RawCard<Identity extends Unsaved = Saved> {
  id: Identity;
  realm: string;

  // Feature Files. Value is path inside the files list
  schema?: string;
  isolated?: string;
  embedded?: string;
  edit?: string;
  serializer?: string;

  // url to the card we adopted from
  adoptsFrom?: string;

  // flat list of files inside our card
  files?: Record<string, string>;

  // if this card contains data (as opposed to just schema & code), it goes here
  data?: RawCardData | undefined;
}

export function assertValidRawCard(obj: any): asserts obj is RawCard {
  if (obj == null) {
    throw new CardstackError('A raw card that is empty is not valid');
  }
  if (typeof obj.id !== 'string') {
    throw new CardstackError('A card requires an id');
  }
  if (typeof obj.realm !== 'string') {
    throw new CardstackError('A card requires a realm');
  }
  let url = obj.url ?? cardURL(obj);
  for (let featureFile of FEATURE_NAMES) {
    if (featureFile in obj) {
      let filePath = obj[featureFile];
      if (typeof filePath !== 'string') {
        throw new CardstackError(`card.json for ${url} has an invalid value for "${featureFile}"`);
      }
      filePath = filePath.replace(/^\.\//, '');
      if (!obj.files?.[filePath]) {
        throw new CardstackError(`card.json for ${url} refers to non-existent module ${obj[featureFile]}`);
      }
    }
  }
  if ('adoptsFrom' in obj) {
    if (typeof obj.adoptsFrom !== 'string') {
      throw new CardstackError(`invalid adoptsFrom property in ${url}`);
    }
  }

  if ('data' in obj) {
    if (typeof obj.data !== 'object' || obj.data == null) {
      throw new CardstackError(`invalid data property in ${url}`);
    }
  }
}

export interface Field<Identity extends Unsaved = Saved, Ref extends ModuleRef = GlobalRef> {
  type: 'contains' | 'containsMany' | 'linksTo';
  computed: boolean;
  card: CompiledCard<Identity, Ref>; // a field's reference to its containing card might not have an ID yet
  name: string;
}

export interface LocalRef {
  local: string;
}
export interface GlobalRef {
  global: string;
}
export type ModuleRef = LocalRef | GlobalRef;
export type Saved = string;
export type Unsaved = string | undefined;

export type CardModules = Record<
  string, // local module path
  CardModule
>;
export interface CardModule {
  type: string;
  source: string;
  ast?: t.File;
}

export type ComponentInfos<Ref extends ModuleRef = ModuleRef> = Record<Format, ComponentInfo<Ref>>;

// CompiledCard is everything you need when operating at the level of code &
// schema changes. It should not be needed just to render and edit data of
// cards.
export interface CompiledCard<Identity extends Unsaved = Saved, Ref extends ModuleRef = GlobalRef> {
  url: Identity;
  realm: string;
  adoptsFrom?: CompiledCard<string, GlobalRef>;
  fields: {
    [key: string]: Field<Identity, Ref>;
  };
  schemaModule: Ref;
  serializerModule?: Ref;

  componentInfos: ComponentInfos<Ref>;
  modules: CardModules;
  deps: string[];
}

export interface ComponentInfo<Ref extends ModuleRef = GlobalRef> {
  componentModule: Ref;
  usedFields: string[]; // ["title", "author.firstName"]

  // optional optimization when this card can be inlined into cards that use it
  inlineHBS?: string;

  // the URL of the card that originally defined this component, if it's not ourself
  inheritedFrom?: string;
}

export interface Card {
  raw: RawCard;
  compiled: CompiledCard;
}

// This is all the thing you need to render and edit data for a card. It's not
// enough to recompile code & schema -- for that you need CompiledCard.
export interface CardContent {
  // Unlike the data in RawCard, this is the fully expanded version that
  // includes computed values and the data from linked cards.
  data: Record<string, any>;

  schemaModule: string;
  componentModule: string;
  usedFields: string[];

  format: Format;
  url: string;
}

export interface Builder {
  getRawCard(url: string): Promise<RawCard>;
  getCompiledCard(url: string): Promise<CompiledCard>;
}

export interface CardModelArgs {
  realm: string;
  schemaModuleRef: string;
  schemaModule: CardSchemaModule;
  format: Format;
  rawData: NonNullable<RawCard['data']>;
  componentModuleRef: ComponentInfo['componentModule']['global'];
  saveModel: (model: CardModel, operation: 'create' | 'update') => Promise<ResourceObject<Saved>>;
}

export interface CardService {
  load(cardURL: string): Promise<Card>;
  loadModel(cardURL: string, format: Format, allFields?: boolean): Promise<CardModel>;
  create(raw: RawCard<Unsaved>): Promise<Card>;
  update(partialRaw: RawCard): Promise<Card>;
  delete(raw: RawCard): Promise<void>;
  query(format: Format, query: Query): Promise<CardModel[]>;
  loadModule<T extends Object>(moduleIdentifier: string): Promise<T>;
}

export interface CardSchema {
  new (rawData: Record<string, any>, makeComplete: boolean, isDeserialized?: boolean): unknown;
  serializedGet(schemaInstance: any, field: string): any;
  serializedSet(schemaInstance: any, field: string, value: any): any;
  serialize(schemaInstance: any, format: Format | 'all'): Record<string, any>;
  hasField(fieldName: string): boolean;
  loadedFields(schemaInstance: any): string[];
}

export interface CardSchemaModule {
  default: CardSchema;
}

export interface CardComponentModule {
  default: unknown;
}

export interface RealmConfig {
  url: string;
  directory: string;
  watch?: boolean;
}

export type ResourceCollection = ResourceObject<Saved>[];

export interface JSONAPIDocument<Identity extends Saved | Unsaved = Saved> {
  data: ResourceObject<Identity> | ResourceCollection;
}

export function assertDocumentDataIsCollection(data: JSONAPIDocument['data']): asserts data is ResourceCollection {
  if (!Array.isArray(data)) {
    throw new CardstackError('JSONAPIDocument was a single resource. We expected a collection');
  }
}

// since the assert type is parameterized, we can't use theJSONAPIDocument['data'] shorthand
export function assertDocumentDataIsResource<Identity extends Saved | Unsaved = Saved>(
  data: ResourceObject<Identity> | ResourceCollection
): asserts data is ResourceObject<Identity> {
  if (Array.isArray(data)) {
    throw new CardstackError('JSONAPIDocument was Collection. We expected a single resource');
  }
}

export function assertIsField(field: any): asserts field is Field {
  let properties = ['type', 'name', 'computed', 'card'];
  if (!properties.map((p) => p in field).every(Boolean)) {
    throw new CardstackError(`expected field to have properties: ${properties.join()}`);
  }
  if (typeof field.card === 'string') {
    throw new CardstackError(`expected field to not be a placeholder`);
  }
}

export interface ResourceObject<Identity extends Saved | Unsaved = Saved> {
  id: Identity;
  type: string;
  attributes?: JSON.Object | undefined;
  relationships?: JSON.Object;
  meta?: JSON.Object;
}
