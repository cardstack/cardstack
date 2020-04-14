import Route from '@ember/routing/route';

export default class IndexRoute extends Route {
  async beforeModel(transition) {
    await super.beforeModel(transition);
    this.transitionTo('movie-registry');
  }
}
