import Route from '@ember/routing/route';

export default class EventsViewRoute extends Route {
  model({ id }) {
    return this.store.findRecord('event', id);
  }
}
