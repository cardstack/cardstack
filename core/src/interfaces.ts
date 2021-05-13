import difference from 'lodash/difference';

const componentFormats = {
  isolated: '',
  embedded: '',
};
export type Format = keyof typeof componentFormats;
export const formats = Object.keys(componentFormats) as Format[];

const featureNamesMap = {
  schema: '',
};
export type FeatureFile = keyof typeof featureNamesMap & Format;
export const featureNames = Object.keys(featureNamesMap).concat(
  formats
) as FeatureFile[];

export type Asset = {
  type: 'css' | 'unknown';
  path: string;
};

export type CardData = Record<string, any>;

export type RawCard = {
  url: string;

  // paths within "files"
  isolated?: string;
  embedded?: string;
  schema?: string;
  containsRoutes?: boolean;

  // url to the card we adopted from
  adoptsFrom?: string;

  // flat list of files inside our card
  files: Record<string, string>;

  // if this card contains data (as opposed to just schema & code), it goes here
  data?: Record<string, any> | undefined;
};

export interface CompiledCard {
  url: string;
  adoptsFrom?: CompiledCard;
  data: Record<string, any> | undefined;
  fields: {
    [key: string]: Field;
  };
  modelModule: string;
  isolated: ComponentInfo;
  embedded: ComponentInfo;
  assets: Asset[];
}
export interface Field {
  type: 'hasMany' | 'belongsTo' | 'contains' | 'containsMany';
  card: CompiledCard;
  name: string;
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
}

export interface RealmConfig {
  url: string;
  directory: string;
}

export function assertValidRawCard(obj: any): asserts obj is RawCard {
  if (obj == null) {
    throw new Error(`not a valid card`);
  }
  if (typeof obj.url !== 'string') {
    throw new Error(`card missing URL`);
  }
  for (let featureFile of featureNames) {
    if (featureFile in obj) {
      if (typeof obj[featureFile] !== 'string') {
        throw new Error(
          `card.json in ${obj.url} has an invalid value for "${featureFile}"`
        );
      }
      // TODO: This should resolve paths, so that isolated.js and ./isolated.js are the same
      if (!obj.files?.[obj[featureFile]]) {
        throw new Error(
          `card.json in ${obj.url} refers to non-existent module ${obj[featureFile]}`
        );
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

export function assertValidCompiledCard(
  card: any
): asserts card is CompiledCard {
  if (!card) {
    throw new Error(`Not a valid Compiled Card`);
  }
  if (!card.url) {
    throw new Error(`CompiledCards must include a url`);
  }
  if (!card.modelModule) {
    throw new Error(
      `${card.url} does not have a schema file. This is wrong and should not happen.`
    );
  }
  if (card.data) {
    let unexpectedFields = difference(
      Object.keys(card.data),
      Object.keys(card.fields)
    );

    if (unexpectedFields.length) {
      throw new Error(
        `Field(s) "${unexpectedFields.join(', ')}" does not exist on card "${
          card.url
        }"`
      );
    }
  }
}
