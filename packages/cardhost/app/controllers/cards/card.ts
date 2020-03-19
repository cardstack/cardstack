import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import RouteInfoService from '../../services/route-info';
export default class CardsIndexController extends Controller {
  @service routeInfo!: RouteInfoService;
}
