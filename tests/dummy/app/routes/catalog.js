import Route from '@ember/routing/route';

export default class CatalogRoute extends Route {
  async model() {
    return await Promise.all([
      this.store.findRecord('article', 'sample'),
      this.store.findRecord('event', 'sample')
    ]);
  }
}
