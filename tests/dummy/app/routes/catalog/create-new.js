import Route from '@ember/routing/route';
import RSVP from 'rsvp';

export default class CatalogCreateNewRoute extends Route {
  model() {
    return RSVP.hash({
      fieldTypes: this.store.findAll('field-type'),
      sampleEvent: this.store.peekRecord('event', 'sample')
      // TODO: start with blank record
    });
  }
}
