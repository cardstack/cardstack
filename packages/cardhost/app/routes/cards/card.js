import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class CardsCardRoute extends Route {
  @service data;

  async model({ name }) {
    return await this.data.getCard(`local-hub::${name}`, 'isolated');
  }
}
