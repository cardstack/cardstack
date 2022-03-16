import * as JSON from 'json-typescript';
import { CardstackError } from './utils/errors';
import type { types as t } from '@babel/core';
import { keys } from './utils';
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

export type SerializerMap = Record<string, PrimitiveSerializer>;
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
  for (let featureFile of FEATURE_NAMES) {
    if (featureFile in obj) {
      let filePath = obj[featureFile];
      if (typeof filePath !== 'string') {
        throw new CardstackError(`card.json for ${obj.url} has an invalid value for "${featureFile}"`);
      }
      filePath = filePath.replace(/^\.\//, '');
      if (!obj.files?.[filePath]) {
        throw new CardstackError(`card.json for ${obj.url} refers to non-existent module ${obj[featureFile]}`);
      }
    }
  }
  if ('adoptsFrom' in obj) {
    if (typeof obj.adoptsFrom !== 'string') {
      throw new CardstackError(`invalid adoptsFrom property in ${obj.url}`);
    }
  }

  if ('data' in obj) {
    if (typeof obj.data !== 'object' || obj.data == null) {
      throw new CardstackError(`invalid data property in ${obj.url}`);
    }
  }
}

export interface Field {
  type: 'contains' | 'containsMany' | 'linksTo';
  computed: boolean;
  card: CompiledCard;
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

// CompiledCard is everything you need when operating at the level of code &
// schema changes. It should not be needed just to render and edit data of
// cards.
export interface CompiledCard<Identity extends Unsaved = Saved, Ref extends ModuleRef = GlobalRef> {
  url: Identity;
  realm: string;
  adoptsFrom?: CompiledCard<string, GlobalRef>;
  fields: {
    [key: string]: Field;
  };
  schemaModule: Ref;
  serializerModule?: Ref;

  componentInfos: ComponentInfos<Ref>;

  modules: CardModules;

  deps: string[];
}

export type ComponentInfos<Ref extends ModuleRef = ModuleRef> = Record<Format, ComponentInfo<Ref>>;

export interface ComponentInfo<Ref extends ModuleRef = GlobalRef> {
  componentModule: Ref;
  usedFields: string[]; // ["title", "author.firstName"]

  // optional optimization when this card can be inlined into cards that use it
  inlineHBS?: string;

  // the URL of the card that originally defined this component, if it's not ourself
  inheritedFrom?: string;
}

export function assertAllComponentInfos(
  infos: Partial<CompiledCard<Unsaved, ModuleRef>['componentInfos']>
): asserts infos is CompiledCard<Unsaved, ModuleRef>['componentInfos'] {
  if (FORMATS.some((f) => !infos[f])) {
    throw new CardstackError(`bug: we're missing a component info`);
  }
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

type UsedFields = Partial<Record<'isolated' | 'embedded' | 'edit', string[]>>;

export interface CardSchemaModule {
  default: {
    new (fieldGetter: (fieldPath: string) => any): unknown;
  };
  serializerMap: SerializerMap;
  usedFields: UsedFields;
  allFields: string[];
  serializeMember: string;
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

export interface ResourceObject<Identity extends Saved | Unsaved = Saved> {
  id: Identity;
  type: string;
  attributes?: JSON.Object | undefined;
  relationships?: JSON.Object;
  meta?: JSON.Object;
}
