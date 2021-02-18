import { helper } from '@ember/component/helper';
import { isPresent as emberIsPresent } from '@ember/utils';

export function isPresent(params) {
  return params.every((p) => emberIsPresent(p));
}

export default helper(function (params /*, hash*/) {
  return isPresent(params);
});
