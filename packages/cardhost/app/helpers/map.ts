import { helper } from '@ember/component/helper';

export default helper(function([arr, fn]) {
  if (Array.isArray(arr) && typeof fn === 'function') {
    return arr.map(i => fn(i));
  }
});
