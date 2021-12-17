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
  type: 'hasMany' | 'belongsTo' | 'contains' | 'containsMany';
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

export interface CompiledCard<Identity extends Unsaved = Saved, Ref extends ModuleRef = GlobalRef> {
  url: Identity;
  realm: string;
  adoptsFrom?: CompiledCard<string, GlobalRef>;
  fields: {
    [key: string]: Field;
  };
  schemaModule: Ref;
  serializer?: SerializerName;
  isolated: ComponentInfo<Ref>;
  embedded: ComponentInfo<Ref>;
  edit: ComponentInfo<Ref>;

  modules: Record<
    string, // local module path
    {
      type: string;
      source: string;
    }
  >;
}

export interface ComponentInfo<Ref extends ModuleRef = GlobalRef> {
  moduleName: Ref;
  usedFields: string[]; // ["title", "author.firstName"]
  inlineHBS?: string;

  // the URL of the card that originally defined this component, if it's not ourself
  inheritedFrom?: string;
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

export interface CardJSONResponse {
  data: {
    id: string;
    type: string;
    attributes?: { [name: string]: any };
    meta?: {
      componentModule: string;
    };
  };
}

export interface CardJSONRequest {
  data: {
    id?: string;
    type: string;
    attributes?: { [name: string]: any };
  };
}

export type CardOperation =
  | {
      create: {
        targetRealm: string;
        parentCardURL: string;
        payload: CardJSONRequest;
      };
    }
  | {
      update: {
        cardURL: string;
        payload: CardJSONRequest;
      };
    };

// this is the set of environment-specific capabilities a CardModel gets access
// to
export interface CardEnv {
  load(url: string, format: Format): Promise<CardModel>;
  send(operation: CardOperation): Promise<CardJSONResponse>;
  prepareComponent(cardModel: CardModel, component: unknown): unknown;
  tracked(target: CardModel, prop: string, desc: PropertyDescriptor): PropertyDescriptor;
}
