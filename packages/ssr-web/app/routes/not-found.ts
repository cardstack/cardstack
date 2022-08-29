import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import ProfileService from '@cardstack/ssr-web/services/profile';
import RouterService from '@ember/routing/router-service';

export const NotFoundError = new Error('404: Not Found');

export default class NotFoundRoute extends Route {
  @service declare router: RouterService;
  @service('profile') declare profile: ProfileService;

  beforeModel() {
    if (this.profile.isActive) {
      this.router.transitionTo('index');
    } else {
      throw NotFoundError;
    }
  }
}
