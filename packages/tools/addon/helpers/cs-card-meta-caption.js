import Helper from '@ember/component/helper';
import { inject as service } from '@ember/service';

export default Helper.extend({
  data: service('cardstack-data'),

  compute([model, caption, isPageModel]) {
    if (isPageModel) {
      return caption;
    }
    let humanId = this.get('data').getCardMeta(model, 'human-id');
    return `${humanId}: ${caption}`;
  }
});

