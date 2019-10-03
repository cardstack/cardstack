import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class CardModelRoute extends Route {
  @service data;

  async model({ id }) {
    return await this.data.getCard(id, 'isolated');
  }
}