const templateTypeNames = {
  isolated: '',
  embedded: '',
};

export type TemplateType = keyof typeof templateTypeNames;

export const templateTypes = Object.keys(templateTypeNames) as TemplateType[];

type TemplateFiles = {
  [K in `${string & keyof typeof templateTypeNames}.hbs`]: string;
};

export function templateFileName(templateType: TemplateType) {
  return `${templateType}.hbs` as `${TemplateType}.hbs`;
}

export type RawCardData = {
  attributes?: { [name: string]: any };
  relationships?: unknown;
};

export type RawCard = {
  url?: string;
  'schema.js': string;

  // TODO: unimplemented
  'data.json'?: RawCardData;
} & Partial<TemplateFiles>;

export interface CompiledCard {
  url: string | undefined;
  adoptsFrom?: CompiledCard;
  modelSource: string;
  data: any;
  fields: {
    [key: string]: {
      type: 'hasMany' | 'belongsTo' | 'contains' | 'containsMany';
      card: CompiledCard;
    };
  };
  templateSources: typeof templateTypeNames;
}
