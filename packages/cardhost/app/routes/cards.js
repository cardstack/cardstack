import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import ENV from '@cardstack/cardhost/config/environment';

const { cardTemplates = [] } = ENV;

export default class CardsRoute extends Route {
  @service data;
  @service library;

  async model() {
    return await Promise.all(cardTemplates.map(i => this.data.getCard(i, 'embedded')));
  }

  @action
  refreshModel() {
    this.refresh();
  }

  @action
  willTransition() {
    this.library.hide();
  }
}
