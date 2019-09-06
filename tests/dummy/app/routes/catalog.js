import BoxelizedRoute from 'boxel/routes/boxelized';

export default class CatalogRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  async model() {
    return await Promise.all([
      this.store.findRecord('article', 'sample'),
      this.store.findRecord('event', 'sample')
    ]);
  }
}
