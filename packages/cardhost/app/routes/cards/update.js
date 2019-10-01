import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class UpdateCardRoute extends Route {
  @service data;

  async model({ id }) {
    // TODO create template for error route for card not found;
    return await this.data.getCard(id, 'isolated');
  }

  @action
  refreshCard() {
    this.refresh();
  }
}