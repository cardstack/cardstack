export interface OcclusionRules {
  includeFields?: (string | InnerOcclusionRules)[];
  includeFieldSet?: string;
}

export interface OcclusionFieldSets {
  [format: string]: (string | InnerOcclusionRules)[];
}

export interface InnerOcclusionRules extends OcclusionRules {
  name: string;
}

export function assertOcclusionRules(rules: any): asserts rules is OcclusionRules {
  throw new Error(`unimplemented`);
}

export function assertOcclusionFieldSets(rules: any): asserts rules is OcclusionFieldSets {
  throw new Error(`unimplemented`);
}
