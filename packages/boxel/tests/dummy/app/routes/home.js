import Route from '@ember/routing/route';

export default class HomeRoute extends Route {
  async beforeModel(transition) {
    await super.beforeModel(transition);
    this.transitionTo('media-registry', 'bunny_records');
  }
}
