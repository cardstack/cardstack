import BoxelizedRoute from '@cardstack/boxel/routes/boxelized';

export default class DemoDragDropRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  async model() {
    return this.store.findRecord('article', 'sample');
  }
}