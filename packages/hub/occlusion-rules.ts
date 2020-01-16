import isPlainObject = require('lodash/isPlainObject');
import CardstackError from './error';

export interface OcclusionRules {
  includeFields?: (string | InnerOcclusionRules)[];
  includeFieldSet?: string;
}

export type OcclusionRulesOrDefaults = OcclusionRules | 'everything' | 'upstream';

export interface OcclusionFieldSets {
  [format: string]: (string | InnerOcclusionRules)[];
}

export interface InnerOcclusionRules extends OcclusionRules {
  name: string;
}

export function assertOcclusionRules(rules: any, errorSource: string): asserts rules is OcclusionRules {
  if (!isPlainObject(rules)) {
    throw new CardstackError(`${errorSource} must be an object`);
  }
  if ('includeFields' in rules) {
    for (let entry of rules.includeFields) {
      if (typeof entry === 'string') {
        continue;
      }
      assertInnerOcclusionRules(entry, errorSource);
    }
  }
  if ('includeFieldSet' in rules) {
    if (typeof rules.includeFieldSet !== 'string') {
      throw new CardstackError(`includeFieldSet in ${errorSource} must be a string`);
    }
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
    if (typeof entry === 'string') {
      continue;
    }
    assertInnerOcclusionRules(entry, `${errorSource}.${field}`);
  }
}
