import { helper } from '@ember/component/helper';

export function objectAt([arr, index]: [any[], number] /*, hash*/) {
  if (index < 0 || index >= arr.length) {
    return null;
  }
  return arr[index];
}

export default helper(objectAt);
