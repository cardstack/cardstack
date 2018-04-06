import { helper as buildHelper } from '@ember/component/helper';

export default buildHelper(function([a]) {
  return a ? String(a) : a;
});
