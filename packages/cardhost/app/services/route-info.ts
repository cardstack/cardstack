import Service from '@ember/service';
import RouterService from '@ember/routing/router-service';
import { inject as service } from '@ember/service';
import { CardstackSession, USER_ORGS } from './cardstack-session';
//@ts-ignore
import ENV from '@cardstack/cardhost/config/environment';

const { environment } = ENV;

export default class RouteInfoService extends Service {
  @service router!: RouterService;
  @service cardstackSession!: CardstackSession;

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

  get currentRealm() {
    if (!this.currentCard) {
      return null;
    }

    if (environment === 'test') {
      return USER_ORGS[0];
    }

    let realmUrl = this.currentCard.csRealm.split('/');
    let id = realmUrl[realmUrl.length - 1];
    let org = USER_ORGS.find(el => el.id === id);
    return org;
  }
}
