import Ember from 'ember';
import layout from '../templates/components/cardstack-tools-launcher';

export default Ember.Component.extend({
  layout,
  tools: Ember.inject.service('cardstack-tools'),
  toolsAvailable: Ember.computed.alias('tools.available'),
  active: Ember.computed.alias('tools.active'),
  tagName: '',
  actions: {
    setActive(isActive) {
      this.get('tools').setActive(isActive);
    },
    toggleActive() {
      this.get('tools').setActive(!this.get('active'));
    }
  }
});
