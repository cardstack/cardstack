import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { A } from '@ember/array';

import layout from '../templates/components/card-picker-toolbox';

export default Component.extend({
  cardPicker: service('cardstack-card-picker'),

  classNames: ['cardstack-card-picker', 'cardstack-tools'],
  pageSize: 12,
  layout,

  init() {
    this._super(...arguments);
    this.set('sort', this.get('cardPicker.initialSort'));
    this.set('uploadedCards', A());
  },

  uploadedFile() {
    // This triggers the cardstack-search component to re-issue the query for all docs
    this.element.querySelector('.cardstack-card-picker--list-wrapper').scrollTop = 0;
    this.set('query', {});
  },

  actions: {
    select(model, event) {
      event.stopPropagation();
      event.preventDefault()

      this.get('cardPicker').resolveCard(model);
      return false;
    },

    closePicker() {
      this.get('cardPicker').closePicker();
    }
  }
});
