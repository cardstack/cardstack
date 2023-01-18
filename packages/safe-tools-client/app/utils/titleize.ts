import { capitalize } from '@ember/string';
import { typeOf } from '@ember/utils';

export function titleize(val: string): string | undefined {
  if (!val || typeOf(val) !== 'string') {
    return;
  }
  const value = val.includes('-') ? val.split('-') : val.split(' ');
  return value.map((el) => capitalize(el)).join(' ');
}
