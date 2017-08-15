import Ember from 'ember';

export default Ember.Route.extend({
  model() {
    return this.store.createRecord('beverage', {
      flavor: 'cola',
      sizeOz: 16
    });
  }
});
