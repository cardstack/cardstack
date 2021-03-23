import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import RouterService from '@ember/routing/router-service';

class CardPayIndexController extends Controller {
  @service router!: RouterService;
  @action transitionTo(routeName: string) {
    this.router.transitionTo(routeName);
  }
}

export default CardPayIndexController;
