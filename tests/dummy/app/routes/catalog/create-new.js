import Route from '@ember/routing/route';

export default class CatalogCreateNewRoute extends Route {
  model() {
    return this.store.peekRecord('event', 'sample');
  }
}
