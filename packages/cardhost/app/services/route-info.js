import Service from '@ember/service';
import { inject as service } from '@ember/service';

export default class RouteInfoService extends Service {
  @service router;

  get mode() {
    let routeSegements = this.router.currentRoute.name.split('.');

    if (routeSegements.length > 1 && routeSegements[routeSegements.length - 1] === 'index') {
      return routeSegements[routeSegements.length - 2];
    }

    return routeSegements[routeSegements.length - 1];
  }
}
