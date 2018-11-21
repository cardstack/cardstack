import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default Controller.extend({
  tools: service('cardstack-card-picker'),

  actions: {
    openButton() {
      let pickupPromise = this.get('tools').pickCard();
      pickupPromise.catch(() => {});
    }
  }
});
