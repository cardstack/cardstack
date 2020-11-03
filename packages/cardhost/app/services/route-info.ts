import Service from '@ember/service';
import RouterService from '@ember/routing/router-service';
import { inject as service } from '@ember/service';

export default class RouteInfoService extends Service {
  @service router!: RouterService;

  get mode() {
    let routeSegments = this.router.currentRoute.name.split('.');

    if (routeSegments.length > 1 && routeSegments[routeSegments.length - 1] === 'index') {
      return routeSegments[routeSegments.length - 2];
    }

    return routeSegments[routeSegments.length - 1];
  }

  get currentCard() {
    let card;
    let route = this.router.currentRoute as any;
    while (route) {
      card = route.attributes && route.attributes.card;
      if (!card) {
        route = route.parent;
      } else {
        break;
      }
    }
    return card;
  }

  get currentOrg() {
    let org;
    let route = this.router.currentRoute as any;
    while (route) {
      org = route.attributes && route.attributes.org;
      if (!org) {
        route = route.parent;
      } else {
        break;
      }
    }
    return org;
  }
}
