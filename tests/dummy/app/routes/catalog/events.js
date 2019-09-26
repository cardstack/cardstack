import Route from '@ember/routing/route';

export default class CatalogEventsRoute extends Route {
  model() {
    let { events } = this.modelFor('catalog');
    return events.toArray();
  }
}
