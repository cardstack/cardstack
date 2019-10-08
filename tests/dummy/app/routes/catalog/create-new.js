import Route from '@ember/routing/route';
import RSVP from 'rsvp';

export default class CatalogCreateNewRoute extends Route {
  model() {
    return RSVP.hash({
      fieldTypes: this.store.findAll('field-type'),
      events: this.store.peekAll('event'),
      sampleEvent: {
        type: 'Event',
        title: 'Sample Event',
        location: 'Earth',
        datetime: '2019-10-21T23:00:00.000Z'
      }
    });
  }
}
