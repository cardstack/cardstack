import Route from '@ember/routing/route';

export default class CatalogEventsRoute extends Route {
  model() {
    return this.store.peekAll('event').toArray();
  }
}
