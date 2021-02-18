import { helper } from '@ember/component/helper';
import { typeOf } from '@ember/utils';
import { dasherize } from '@ember/string';

export default helper(function formatId([val]) {
  if (!val || typeOf(val) !== 'string') {
    return;
  }
  return dasherize(val.trim());
});
