import Route from '@ember/routing/route';
import Transition from '@ember/routing/-private/transition';

export default class IndexRoute extends Route {
  async beforeModel(transition: Transition) {
    await super.beforeModel(transition);
    this.transitionTo('cards');
  }
}
