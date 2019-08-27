import BoxelizedRoute from 'boxel/routes/boxelized';

export default class CatalogRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  model() {
    return [
      this.store.peekRecord('article', 'sample'),
      this.store.peekRecord('event', 'sample')
    ];
  }
}
