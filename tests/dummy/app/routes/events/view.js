import Route from '@ember/routing/route';

export default class EventsViewRoute extends Route {
  boxelPlane = 'space';

  async model({ id }) {
    return await this.store.findRecord('event', id);
  }
}
