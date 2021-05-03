import { CompiledCard } from '@cardstack/core/src/interfaces';
import { compiledBaseCard } from '../../src/compiler';

export const COMPILED_STRING_CARD: CompiledCard = {
  url: 'https://cardstack.com/base/string',
  modelModule: '@cardstack/compiled/https-cardstack.com-base-string/schema.js',
  fields: {},
  data: {},
  assets: [],
  isolated: {
    moduleName: 'todo',
    usedFields: [],
  },
  embedded: {
    moduleName:
      '@cardstack/compiled/https-cardstack.com-base-string/embedded.js',
    usedFields: [],
    inlineHBS: '{{@model}}',
  },
  adoptsFrom: compiledBaseCard,
};

export const COMPILED_DATE_CARD: CompiledCard = {
  url: 'https://cardstack.com/base/date/',
  modelModule: '@cardstack/compiled/https-cardstack.com-base-date/schema.js',
  fields: {},
  data: {},
  assets: [],
  isolated: {
    moduleName: 'todo',
    usedFields: [],
  },
  embedded: {
    moduleName: '@cardstack/compiled/https-cardstack.com-base-date/embedded.js',
    usedFields: [],
  },
  adoptsFrom: compiledBaseCard,
};
