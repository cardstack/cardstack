import { typeOf } from '@ember/utils';
import { capitalize } from '@ember/string';

export function titleize(val) {
  if (!val || typeOf(val) !== 'string' ) { return; }
  return val.split(' ').map(el => capitalize(el)).join(' ');
}
