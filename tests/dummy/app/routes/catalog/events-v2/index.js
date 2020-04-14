import Route from '@ember/routing/route';

export default class CatalogEventsV2IndexRoute extends Route {
  async model() {
    return await this.store.findAll('event');
  }
}
