import { helper as buildHelper } from '@ember/component/helper';
import { singularize } from 'ember-inflector';

export default buildHelper(function([a]) {
  return singularize(a);
});
