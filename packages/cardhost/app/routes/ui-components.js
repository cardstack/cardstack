import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import ENV from '@cardstack/cardhost/config/environment'

const { environment } = ENV;
export default class UIComponentsRoute extends Route {
  @service data;

  async model() {
    if (environment === 'development') {
      return await this.data.getCard('local-hub::event', 'isolated');
    }

    return await this.data.getCard('local-hub::@cardstack/base-card', 'isolated');
  }
}
