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

export type RawCard = {
  url?: string;
  'schema.js': string;
} & TemplateFiles;

export interface CompiledCard {
  url: string | undefined;
  modelSource: string;
  fields: {
    [key: string]: {
      type: 'hasMany' | 'belongsTo' | 'contains' | 'containsMany';
      card: CompiledCard;
    };
  };
  templateSources: typeof templateTypeNames;
}
