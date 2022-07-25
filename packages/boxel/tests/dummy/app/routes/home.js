import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class HomeRoute extends Route {
  @service router;

  async beforeModel(transition) {
    await super.beforeModel(transition);
    this.router.transitionTo('media-registry', 'bunny_records');
  }
}
