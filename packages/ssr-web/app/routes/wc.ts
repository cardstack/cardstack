import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';
import ProfileService from '@cardstack/ssr-web/services/profile';
import '../css/wc.css';
export default class WcRoute extends Route {
  @service declare router: RouterService;
  @service('profile') declare profile: ProfileService;

  beforeModel() {
    if (this.profile.isActive) {
      this.router.transitionTo('index');
    }
  }
}
