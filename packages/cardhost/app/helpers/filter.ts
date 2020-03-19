import { helper } from '@ember/component/helper';

export default helper(function([array, conditionFn]) {
  if (!Array.isArray(array) || typeof conditionFn !== 'function') {
    return;
  }
  return array.filter(item => conditionFn(item));
});
