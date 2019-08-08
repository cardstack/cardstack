import Route from '@ember/routing/route';

export default class CatalogRoute extends Route {
  async model() {
    let articles = await this.store.findAll('article');
    let events = await this.store.findAll('event');

    return [ articles.objectAt(0), events.objectAt(0) ];
  }
}
