import { typeOf } from '@ember/utils';
import { dasherize } from '@ember/string';

export function formatId(val) {
  if (!val || typeOf(val) !== 'string' ) { return; }
  return dasherize(val.trim());
}
