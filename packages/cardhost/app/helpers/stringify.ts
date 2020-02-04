import { helper } from '@ember/component/helper';

export default helper(function([obj]) {
  return JSON.stringify(obj, null, 2);
});
