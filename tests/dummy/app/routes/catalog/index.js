import Route from '@ember/routing/route';

export default class CatalogIndexRoute extends Route {
  model() {
    let article = this.store.peekRecord('article', 'sample');
    let event = this.store.peekRecord('event', 'sample');

    return [ article, event ];
  }
}
