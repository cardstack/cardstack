import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class CatalogRoute extends Route {
  @service boxel;

  model({ id }) {
    return this.store.peekRecord('article', id);
  }

  renderTemplate(/*controller, model*/) {
    this.render('articles', {
      into: 'application',
      outlet: 'space'
    });
  }
}
