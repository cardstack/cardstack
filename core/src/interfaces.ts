export interface RawCard {
  url?: string;
  'schema.js': string;
  'isolated.hbs'?: string;
}

export interface CompiledCard {
  url: string | undefined;
  modelSource: string;
  fields: {
    [key: string]: {
      type: 'hasMany' | 'belongsTo' | 'contains' | 'containsMany';
      card: CompiledCard;
    };
  };
  templateSources: {
    isolated: string;
    embedded: string;
  };
}
