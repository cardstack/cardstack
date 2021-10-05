import difference from 'lodash/difference';
import type CardModel from './card-model';
import { InvalidKeysError } from './errors';

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

export type CardData = Record<string, any>;

export type Setter = (value: any) => void;

/* Card type IDEAS
  primitive:
    Where card is a value, has validation and/or a serialize. IE: Date, string
    Has a @value attribute
  composite:
    Where card is combining multifle cards, ie: A blog post
    Has a @model attribute
  data:
    A card that likely adopts from a composite card, but only provides new data for it
*/

export type RawCard = {
  url: string;

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
};
export interface Field {
  type: 'hasMany' | 'belongsTo' | 'contains' | 'containsMany';
  card: CompiledCard;
  name: string;
}

export interface CompiledCard {
  url: string;
  adoptsFrom?: CompiledCard;
  fields: {
    [key: string]: Field;
  };
  schemaModule: string;
  serializer?: SerializerName;

  isolated: ComponentInfo;
  embedded: ComponentInfo;
  edit: ComponentInfo;
}

export interface ComponentInfo {
  moduleName: string;
  usedFields: string[]; // ["title", "author.firstName"]

  inlineHBS?: string;
  sourceCardURL: string;
}

export interface Builder {
  getRawCard(url: string): Promise<RawCard>;
  getCompiledCard(url: string): Promise<CompiledCard>;

  // returns the module identifier that can be used to get this module back.
  // It's exactly meaning depends on the environment. In node it's a path you
  // can actually `require`.
  define: (cardURL: string, localModule: string, type: string, source: string) => Promise<string>;
}

export interface RealmConfig {
  url: string;
  directory?: string;
}

export type CardJSONResponse = {
  data: {
    id: string;
    type: string;
    attributes?: { [name: string]: any };
    meta?: {
      componentModule: string;
    };
  };
};

export type CardJSONRequest = {
  data: {
    id?: string;
    type: string;
    attributes?: { [name: string]: any };
  };
};

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

// this is the set of enviroment-specific capabilities a CardModel gets access
// to
export interface CardEnv {
  load(url: string, format: Format): Promise<CardModel>;
  send(operation: CardOperation): Promise<CardJSONResponse>;
  prepareComponent(cardModel: CardModel, component: unknown): unknown;
  tracked(taret: object, prop: string, desc: PropertyDescriptor): PropertyDescriptor;
}

export function assertValidRawCard(obj: any): asserts obj is RawCard {
  if (obj == null) {
    throw new Error(`not a valid card`);
  }
  if (typeof obj.url !== 'string') {
    throw new Error(`card missing URL`);
  }
  for (let featureFile of FEATURE_NAMES) {
    if (featureFile in obj) {
      let filePath = obj[featureFile];
      if (typeof filePath !== 'string') {
        throw new Error(`card.json in ${obj.url} has an invalid value for "${featureFile}"`);
      }
      filePath = filePath.replace(/^\.\//, '');
      if (!obj.files?.[filePath]) {
        throw new Error(`card.json in ${obj.url} refers to non-existent module ${obj[featureFile]}`);
      }
    }
  }
  if ('adoptsFrom' in obj) {
    if (typeof obj.adoptsFrom !== 'string') {
      throw new Error(`invalid adoptsFrom property in ${obj.url}`);
    }
  }

  if ('data' in obj) {
    if (typeof obj.data !== 'object' || obj.data == null) {
      throw new Error(`invalid data property in ${obj.url}`);
    }
  }
}

type Newable<T> = { new (...args: any[]): T };

export function assertValidKeys(
  actualKeys: string[],
  expectedKeys: string[],
  errorMessage: string,
  ErrorClass: Newable<Error> = InvalidKeysError
) {
  let unexpectedFields = difference(actualKeys, expectedKeys);

  if (unexpectedFields.length) {
    throw new ErrorClass(errorMessage.replace('%list%', '"' + unexpectedFields.join(', ') + '"'));
  }
}

export function assertValidSerializerMap(map: any): asserts map is SerializerMap {
  let keys = Object.keys(map);
  let diff = difference(keys, SERIALIZER_NAMES);
  if (diff.length > 0) {
    throw new Error(`Unexpected serializer: ${diff.join(',')}`);
  }
}
