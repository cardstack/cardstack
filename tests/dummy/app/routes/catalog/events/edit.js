import Route from '@ember/routing/route';

export default class CatalogEventsEditRoute extends Route {
  model({ id }) {
    return this.store.peekRecord('event', id);
  }
}
