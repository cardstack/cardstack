import Route from '@ember/routing/route';

export default class CatalogEventsV2EditRoute extends Route {
  model({ id }) {
    return this.store.peekRecord('event', id);
  }
}
