import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default Controller.extend({
  tools: service('cardstack-card-picker'),

  actions: {
    openButton() {
      this.get('tools').pickCard();
    }
  }
});
