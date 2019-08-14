import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class CatalogRoute extends Route {
  @service boxel;

  async model() {
    return await Promise.all([
      this.store.findRecord('article', 'sample'),
      this.store.findRecord('event', 'sample')
    ]);
  }

  renderTemplate(/*controller, model*/) {
    this.render('catalog', {
      into: 'application',
      outlet: 'space'
    });
  }
}
