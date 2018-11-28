import Helper from '@ember/component/helper';
import { inject as service } from '@ember/service';

export default Helper.extend({
  data: service('cardstack-data'),

  compute([ model ]) {
    return this.get('data').getCardMeta(model, 'uid');
  }
});

