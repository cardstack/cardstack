import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cs-field-overlays';

export default Component.extend({
  layout,
  classNames: ['cardstack-tools'],
  tools: service('cardstack-tools'),
  actions: {
    openField(which) {
      this.get('tools').openField(which);
    }
  }
});
