import Ember from 'ember';

export default Ember.Service.extend({
  available: true,
  active: false,
  activePanel: 'cardstack-toolbox',
  setActive(isActive) {
    this.set('active', isActive);
  }
});
