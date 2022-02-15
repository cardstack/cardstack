import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { Registry as Services } from '@ember/service';
import { action } from '@ember/object';

import Layer2Network from '@cardstack/ssr-web/services/layer2-network';

class ApplicationController extends Controller {
  @service router!: Services['router'];
  @service declare layer2Network: Layer2Network;

  @action transitionTo(routeName: string) {
    this.router.transitionTo(routeName);
  }
}

export default ApplicationController;
