import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import Component from '@ember/component';
import layout from '../templates/components/cardstack-tools-launcher';

export default Component.extend({
  layout,
  tools: service('cardstack-tools'),
  toolsAvailable: alias('tools.available'),
  active: alias('tools.active'),
  tagName: '',
  actions: {
    setActive(isActive) {
      this.get('tools').setActive(isActive);
    },
    toggleActive() {
      this.get('tools').setActive(!this.get('active'));
    },
  },
});
