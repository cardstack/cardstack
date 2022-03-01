import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import AppContextService from '@cardstack/ssr-web/services/app-context';

export default class PayRoute extends Route {
  @service('app-context') declare appContext: AppContextService;

  beforeModel() {
    if (this.appContext.currentApp == 'card-space') {
      this.transitionTo('index');
    } else {
      throw new Error('404: Not Found');
    }
  }
}
