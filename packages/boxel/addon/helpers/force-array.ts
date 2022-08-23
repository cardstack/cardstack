// prettier-ignore
import { helper } from '@ember/component/helper';

export default helper(function forceArray([val]: [any]) {
  return [].concat(val);
});
