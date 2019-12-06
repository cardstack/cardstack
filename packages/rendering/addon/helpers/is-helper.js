import Helper from '@ember/component/helper';
import { getOwner } from '@ember/application';

export default Helper.extend({
  compute([name]) {
    return !!getOwner(this).lookup(`helper:${name}`);
  },
});
