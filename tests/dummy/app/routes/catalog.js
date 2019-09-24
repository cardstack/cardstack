import BoxelizedRoute from 'boxel/routes/boxelized';
import RSVP from 'rsvp';

export default class CatalogRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  model() {
    return RSVP.hash({
      articles: this.store.findAll('article'),
      events: this.store.findAll('event')
    });
  }
}
