import { helper } from '@ember/component/helper';

export default helper(function forceArray([val]) {
  return [].concat(val);
});
