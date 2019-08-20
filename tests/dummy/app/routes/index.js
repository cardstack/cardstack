import Route from '@ember/routing/route';

export default class IndexRoute extends Route {
  async beforeModel(/*transition*/) {
    this.transitionTo('catalog');
  }
}
