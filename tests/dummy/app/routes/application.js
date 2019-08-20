import Route from '@ember/routing/route';

export default class ApplicationRoute extends Route {
  async model() {
    return await Promise.all([
      this.store.findAll('article'),
      this.store.findAll('event')
    ]);
  }
}
