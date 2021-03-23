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
    [key: string]: {
      type: 'hasMany' | 'belongsTo' | 'contains' | 'containsMany';
      card: CompiledCard;
    };
  };
  modelModule: string;
  templateModules: {
    [K in keyof typeof templateTypeNames]: TemplateModule;
  };
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

export type defineModuleCallback = (
  fullModuleURL: string,
  source: unknown
) => Promise<void>;
