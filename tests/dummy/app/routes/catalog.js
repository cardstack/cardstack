import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class CatalogRoute extends Route {
  @service boxel;

  model() {
    return [
      this.store.peekRecord('article', 'sample'),
      this.store.peekRecord('event', 'sample')
    ];
  }

  renderTemplate(/*controller, model*/) {
    this.render('catalog', {
      into: 'application',
      outlet: 'space'
    });
  }
}
