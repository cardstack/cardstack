const componentFormats = {
  isolated: '',
  embedded: '',
};
export type Format = keyof typeof componentFormats;
export const formats = Object.keys(componentFormats) as Format[];

export type RawCard = {
  url: string;

  // paths within "files"
  isolated?: string;
  embedded?: string;
  schema?: string;

  // url to the card we adopted from
  adoptsFrom?: string;

  // flat list of files inside our card
  files: Record<string, string>;

  // if this card contains data (as opposed to just schema & code), it goes here
  data?: Record<string, any>;
};

export function assertValidRawCard(obj: any): asserts obj is RawCard {
  if (obj == null) {
    throw new Error(`not a valid card`);
  }
  if (typeof obj.url !== 'string') {
    throw new Error(`card missing URL`);
  }
  for (let fileFeature of ['isolated', 'embedded', 'schema']) {
    if (fileFeature in obj) {
      if (typeof obj[fileFeature] !== 'string') {
        throw new Error(
          `card.json in ${obj.url} has an invalid value for "${fileFeature}"`
        );
      }
      // TODO: This should resolve paths, so that isolated.js and ./isolated.js are the same
      if (!obj.files?.[obj[fileFeature]]) {
        throw new Error(
          `card.json in ${obj.url} refers to non-existent module ${obj[fileFeature]}`
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
}
export interface Field {
  type: 'hasMany' | 'belongsTo' | 'contains' | 'containsMany';
  card: CompiledCard;
  localName: string;
}

export interface ComponentInfo {
  moduleName: string;
  usedFields: string[]; // ["title", "author.firstName"]
  inlineHBS?: string;
}

export interface Builder {
  getRawCard(url: string): Promise<RawCard>;
  getCompiledCard(url: string): Promise<CompiledCard>;
}
