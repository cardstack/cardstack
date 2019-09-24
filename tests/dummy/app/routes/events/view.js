import BoxelizedRoute from 'boxel/routes/boxelized';

export default class EventsViewRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  async model({ id }) {
    return await this.store.findRecord('event', id);
  }
}
