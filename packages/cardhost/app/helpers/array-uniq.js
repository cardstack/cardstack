import uniq from 'lodash/uniq';
import { helper } from '@ember/component/helper';

export default helper(function([arr]) {
  if (Array.isArray(arr)) {
    return uniq(arr);
  }
});
