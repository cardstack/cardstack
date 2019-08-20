import Route from '@ember/routing/route';

export default class CatalogPreviewRoute extends Route {
  model({ model }) {
    return this.store.peekRecord(model, 'sample');
  }
}
