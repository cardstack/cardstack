import { helper } from '@ember/component/helper';

export function dec([value, amount = 1]: [number, number] /*, hash*/) {
  return value - amount;
}

export default helper(dec);
