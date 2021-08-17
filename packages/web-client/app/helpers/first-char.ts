import { helper } from '@ember/component/helper';

export function firstChar([str]: [string] /*, hash*/) {
  if (!str || typeof str !== 'string') {
    return;
  }
  return str.trim()[0];
}

export default helper(firstChar);
