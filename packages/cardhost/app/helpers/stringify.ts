import { helper } from '@ember/component/helper';

export default helper(function([obj, indent = 0]) {
  return JSON.stringify(obj, null, indent);
});
