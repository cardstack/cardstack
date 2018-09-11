import Route from '@ember/routing/route';

export default Route.extend({
  model() {
    return this.store.createRecord('beverage', {
      flavor: 'cola',
      size: 16,
      sizeUnits: 'oz',
      serialCode: '9789929-591332'
    });
  }
});
