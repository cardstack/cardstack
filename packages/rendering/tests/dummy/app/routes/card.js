import Route from '@ember/routing/route';

export default Route.extend({
  model() {
    return this.store.createRecord('beverage', {
      flavor: 'tea',
      size: 1,
      sizeUnits: 'cup'
    });
  }
});
