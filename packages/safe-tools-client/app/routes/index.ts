import Route from '@ember/routing/route';
import type RouterService from '@ember/routing/router-service';
import { inject as service } from '@ember/service';

export default class Index extends Route {
  @service declare router: RouterService;

  beforeModel() {
    this.router.replaceWith('schedule');
  }
}
