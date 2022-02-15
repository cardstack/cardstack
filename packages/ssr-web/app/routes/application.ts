import Route from '@ember/routing/route';
import RouterService from '@ember/routing/router-service';
import { inject as service } from '@ember/service';
import '@cardstack/ssr-web/css/variables.css';
import '@cardstack/ssr-web/css/card-space.css';

export default class ApplicationRoute extends Route {
  @service declare router: RouterService;
}
