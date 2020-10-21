import Service from '@ember/service';
import RouterService from '@ember/routing/router-service';
import { inject as service } from '@ember/service';

export default class RouteInfoService extends Service {
  @service router!: RouterService;

  get mode() {
    let routeSegements = this.router.currentRoute.name.split('.');

    if (routeSegements.length > 1 && routeSegements[routeSegements.length - 1] === 'index') {
      return routeSegements[routeSegements.length - 2];
    }

    return routeSegements[routeSegements.length - 1];
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
}
