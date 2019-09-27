import Route from '@ember/routing/route';

export default class EventsViewRoute extends Route {
  async model({ id }) {
    return await this.store.findRecord('event', id);
  }
}
