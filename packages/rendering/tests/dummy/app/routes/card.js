import Ember from 'ember';

export default Ember.Route.extend({
  model() {
    return this.store.createRecord('beverage', {
      flavor: 'tea',
      size: 1,
      sizeUnits: 'cup'
    });
  }
});
