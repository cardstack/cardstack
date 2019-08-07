import Route from '@ember/routing/route';

export default class CatalogRoute extends Route {
  async model() {
    return await this.store.findAll('article');
  }
}
