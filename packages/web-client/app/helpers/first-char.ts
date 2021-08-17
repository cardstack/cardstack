import { helper } from '@ember/component/helper';

export function firstChar([val]: [string] /*, hash*/) {
  let str = String(val).trim();
  return str[0];
}

export default helper(firstChar);
