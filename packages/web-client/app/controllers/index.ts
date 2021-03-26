import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { Registry as Services } from '@ember/service';
import { action } from '@ember/object';

class IndexController extends Controller {
  @service router!: Services['router'];
  @action transitionTo(routeName: string) {
    this.router.transitionTo(routeName);
  }
}

export default IndexController;
