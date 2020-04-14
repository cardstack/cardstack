import BoxelizedRoute from '@cardstack/boxel/routes/boxelized';
import RSVP from 'rsvp';

export default class ToolsRoute extends BoxelizedRoute {
  boxelPlane = 'tools';

  model() {
    return RSVP.hash({
      articles: this.store.findAll('article'),
      events: this.store.findAll('event')
    });
  }
}
