const templateTypeNames = {
  isolated: '',
  embedded: '',
};

export type TemplateType = keyof typeof templateTypeNames;

export const templateTypes = Object.keys(templateTypeNames) as TemplateType[];

type TemplateFiles = {
  [K in `${string & keyof typeof templateTypeNames}.js`]: string;
};

export function templateFileName(templateType: TemplateType) {
  return `${templateType}.js` as `${TemplateType}.js`;
}

export type RawCard = {
  url: string;
  files: {
    'schema.js': string;
    'data.json'?: RawCardData;
  } & Partial<TemplateFiles>;
};

export type RawCardData = {
  attributes?: { [name: string]: any };
  relationships?: unknown;
};
export interface CompiledCard {
  url: string;
  adoptsFrom?: CompiledCard;
  data: any;
  fields: {
    [key: string]: Field;
  };
  modelModule: string;
  templateModules: {
    [K in keyof typeof templateTypeNames]: TemplateModule;
  };
}
export interface Field {
  type: 'hasMany' | 'belongsTo' | 'contains' | 'containsMany';
  card: CompiledCard;
  localName: string;
}

export interface TemplateModule {
  moduleName: string;
  // usedFields: string[]; // ["title", "author.firstName"]
  inlineHBS?: string;
}

export interface Builder {
  getRawCard(url: string): Promise<RawCard>;
  getCompiledCard(url: string): Promise<CompiledCard>;
}

export interface CardServerResponse {
  data: {
    id: string;
    type: string;
    attributes?: { [name: string]: any };
    meta: {
      componentModule: string;
    };
  };
}
