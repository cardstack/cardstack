import Route from '@ember/routing/route';

export default class CatalogIndexRoute extends Route {
  model() {
    let article = this.store.findRecord('article', 'sample');
    let event = this.store.findRecord('event', 'sample');

    return [ article, event ];
  }
}
