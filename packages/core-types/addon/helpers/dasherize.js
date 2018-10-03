import { helper as buildHelper } from '@ember/component/helper';
import { dasherize } from '@ember/string';

export default buildHelper(function([a]) {
  return dasherize(a);
});
