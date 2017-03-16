import Ember from 'ember';
import layout from '../templates/components/cardstack-tools-launcher';

export default Ember.Component.extend({
  layout,
  toolsAvailable: true,
  active: false,
  actions: {
    setActive(isActive) {
      this.set('active', isActive);
    },
    toggleActive() {
      this.set('active', !this.get('active'));
    }
  }
});
