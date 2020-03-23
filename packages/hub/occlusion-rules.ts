import isPlainObject from 'lodash/isPlainObject';
import { CardstackError } from './error';

export interface OcclusionRules {
  includeFields?: (string | InnerOcclusionRules)[];
  includeFieldSet?: Format;
}
export type Format = keyof OcclusionFieldSets | 'everything' | 'upstream';

export interface OcclusionFieldSets {
  isolated: (string | InnerOcclusionRules)[];
  embedded: (string | InnerOcclusionRules)[];
}

export interface InnerOcclusionRules extends OcclusionRules {
  name: string;
}

export function assertOcclusionRules(rules: any, errorSource: string): asserts rules is OcclusionRules {
  if (!isPlainObject(rules)) {
    throw new CardstackError(`${errorSource} must be an object`);
  }
  if ('includeFields' in rules) {
    assertIncludeFields(rules.includeFields, `${errorSource}.includeFields`);
  }
  if ('includeFieldSet' in rules) {
    if (typeof rules.includeFieldSet !== 'string') {
      throw new CardstackError(`includeFieldSet in ${errorSource} must be a string`);
    }
  }
}

function assertIncludeFields(fields: any, errorSource: string): asserts fields is (string | InnerOcclusionRules)[] {
  if (!Array.isArray(fields)) {
    throw new CardstackError(`${errorSource} must be an array`);
  }
  for (let entry of fields) {
    if (typeof entry === 'string') {
      continue;
    }
    assertInnerOcclusionRules(entry, errorSource);
  }
}

function assertInnerOcclusionRules(rules: any, errorSource: string): asserts rules is InnerOcclusionRules {
  assertOcclusionRules(rules, errorSource);
  if (typeof (rules as any).name !== 'string') {
    throw new CardstackError(`occlusion rule missing name: ${JSON.stringify(rules)}`);
  }
}

export function assertOcclusionFieldSets(rules: any, errorSource: string): asserts rules is OcclusionFieldSets {
  if (!isPlainObject(rules)) {
    throw new CardstackError(`${errorSource} must be an object`);
  }
  for (let [field, entry] of Object.entries(rules)) {
    assertIncludeFields(entry, `${errorSource}.${field}`);
  }
}
