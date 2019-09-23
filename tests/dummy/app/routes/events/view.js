import BoxelizedRoute from 'boxel/routes/boxelized';

export default class EventsViewRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  model({ id }) {
    return this.store.findRecord('event', id);
  }
}
