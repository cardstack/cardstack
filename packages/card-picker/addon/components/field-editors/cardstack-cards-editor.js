import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { get, set } from '@ember/object';

import layout from '../../templates/components/field-editors/cardstack-cards-editor';

export default Component.extend({
  tools: service('cardstack-card-picker'),
  layout,

  actions: {
    addCard() {
      let field = get(this, 'field');
      let content = get(this, 'content');

      this.tools.pickCard().then(card => {
        content.watchRelationship(field, () => {
          get(content, field).pushObject(card);
        });
      });
    },

    orderChanged(rearrangedCards) {
      let field = get(this, 'field');
      let content = get(this, 'content');

      content.watchRelationship(field, () => {
        set(content, field, rearrangedCards);
      });
    },

    deleteCard(card) {
      let field = get(this, 'field');
      let content = get(this, 'content');

      content.watchRelationship(field, () => {
        get(content, field).removeObject(card);
      });
    },
  },
});
