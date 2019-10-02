import Route from '@ember/routing/route';

export default class CatalogEventsV2Route extends Route {
  model() {
    let { events } = this.modelFor('catalog');
    return events.toArray();
  }
}
