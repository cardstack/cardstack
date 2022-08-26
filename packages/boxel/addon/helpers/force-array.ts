// prettier-ignore
import { helper } from '@ember/component/helper';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default helper(function forceArray([val]: [any]) {
  return [].concat(val);
});
