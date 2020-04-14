import Route from '@ember/routing/route';

export default class CatalogEventsIndexRoute extends Route {
  async model() {
    return await this.store.findAll('event');
  }
}
