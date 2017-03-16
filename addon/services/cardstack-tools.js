import Ember from 'ember';

export default Ember.Service.extend({
  available: true,
  active: false,
  setActive(isActive) {
    this.set('active', isActive);
  }
});
