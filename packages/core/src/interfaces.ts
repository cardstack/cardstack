import * as JSON from 'json-typescript';
import difference from 'lodash/difference';
import type CardModel from './card-model';
import { CardstackError } from './utils/errors';

const componentFormats = {
  isolated: '',
  embedded: '',
  edit: '',
};
export type Format = keyof typeof componentFormats;
export const FORMATS = Object.keys(componentFormats) as Format[];

export function isFormat(s: any): s is Format {
  return s && s in componentFormats;
}

const featureNamesMap = {
  schema: '',
};
export type FeatureFile = keyof typeof featureNamesMap & Format;
export const FEATURE_NAMES = Object.keys(featureNamesMap).concat(FORMATS) as FeatureFile[];

const serializerTypes = {
  date: '',
  datetime: '',
};
export type SerializerName = keyof typeof serializerTypes;
export const SERIALIZER_NAMES = Object.keys(serializerTypes) as SerializerName[];
export type SerializerMap = { [key in SerializerName]?: string[] };

export function assertValidSerializerMap(map: any): asserts map is SerializerMap {
  let keys = Object.keys(map);
  let diff = difference(keys, SERIALIZER_NAMES);
  if (diff.length > 0) {
    throw new CardstackError(`Unexpected serializer: ${diff.join(',')}`);
  }
}

export type CardData = Record<string, any>;

export type Setter = (value: any) => void;

export interface CardId {
  realm: string;
  id: string;
}

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

  deserializer?: SerializerName;

  // url to the card we adopted from
  adoptsFrom?: string;

  // flat list of files inside our card
  files?: Record<string, string>;

  // if this card contains data (as opposed to just schema & code), it goes here
  data?: Record<string, any> | undefined;
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
  serializer?: SerializerName;

  isolated: CompilerComponentInfo<Ref>;
  embedded: CompilerComponentInfo<Ref>;
  edit: CompilerComponentInfo<Ref>;

  modules: Record<
    string, // local module path
    {
      type: string;
      source: string;
    }
  >;

  deps: string[];
}

export interface ComponentInfo<Ref extends ModuleRef = GlobalRef> {
  moduleName: Ref;
  usedFields: string[]; // ["title", "author.firstName"]
}

export interface CompilerComponentInfo<Ref extends ModuleRef = GlobalRef> extends ComponentInfo<Ref> {
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
export interface CardContent<Ref extends ModuleRef = GlobalRef> {
  // Unlike the data in RawCard, this is the fully expanded veresion that
  // includes computed values and the data from linked cards.
  data: Record<string, any>;

  isolated: ComponentInfo<Ref>;
  embedded: ComponentInfo<Ref>;
  edit: ComponentInfo<Ref>;

  schemaModule: Ref;

  format: Format;
  url: string;
}

export interface Builder {
  getRawCard(url: string): Promise<RawCard>;
  getCompiledCard(url: string): Promise<CompiledCard>;
}

export interface RealmConfig {
  url: string;
  directory: string;
  watch?: boolean;
}

export interface JSONAPIDocument<Identity extends Saved | Unsaved = Saved> {
  data: ResourceObject<Identity>;
}
export interface ResourceObject<Identity extends Saved | Unsaved = Saved> {
  id: Identity;
  type: string;
  attributes?: JSON.Object;
  relationships?: JSON.Object;
  meta?: JSON.Object;
}

export type CardOperation =
  | {
      create: {
        targetRealm: string;
        parentCardURL: string;
        payload: JSONAPIDocument<Unsaved>;
      };
    }
  | {
      update: {
        cardURL: string;
        payload: JSONAPIDocument;
      };
    };

// this is the set of environment-specific capabilities a CardModel gets access
// to
export interface CardEnv {
  load(url: string, format: Format): Promise<CardModel>;
  send(operation: CardOperation): Promise<JSONAPIDocument>;
  prepareComponent(cardModel: CardModel, component: unknown): unknown;
  tracked(target: CardModel, prop: string, desc: PropertyDescriptor): PropertyDescriptor;
}
