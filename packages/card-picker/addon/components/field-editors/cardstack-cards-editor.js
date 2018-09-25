import Component from '@ember/component';
import { inject as service } from '@ember/service';

import layout from '../../templates/components/field-editors/cardstack-cards-editor';

export default Component.extend({
  tools: service('cardstack-card-picker'),
  layout,

  actions: {
    addCard() {
      this.tools.pickCard().then((card) => {
        this.get(`content.${this.get('field')}`).pushObject(card);
      })
    },
    orderChanged(rearrangedCards) {
      this.set(`content.${this.get('field')}`, rearrangedCards);
    },
    deleteCard(card) {
      this.get(`content.${this.get('field')}`).removeObject(card);
    }
  }
});
