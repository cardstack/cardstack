import BoxelizedRoute from 'boxel/routes/boxelized';

export default class FieldTypesDemoRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  async model() {
    return this.store.findRecord('article', 'sample2');
  }
}
