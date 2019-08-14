import Route from '@ember/routing/route';

export default class CatalogPreviewRoute extends Route {
  model(params) {
    return this.store.peekRecord(params.model, 'sample');
  }
}
