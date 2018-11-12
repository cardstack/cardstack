import Component from '@ember/component';
import { inject as service } from '@ember/service';

import layout from '../templates/components/card-picker-toolbox';

export default Component.extend({
  tools: service('cardstack-card-picker'),

  classNames: ['cardstack-card-picker', 'cardstack-tools'],
  layout,

  actions: {
    select(model, event) {
      event.stopPropagation();
      event.preventDefault();

      this.tools.resolveCard(model);
      return false;
    },
  },
});
