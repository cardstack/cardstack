import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import ENV from '@cardstack/cardhost/config/environment';
import { hash } from 'rsvp';

const { environment, cardTemplates = [] } = ENV;

export default class IndexRoute extends Route {
  @service data;

  async model() {
    if (environment === 'development') {
      // prime the store with seed models
      await this.data.getCard('local-hub::why-doors', 'isolated');
    }

    return await hash({
      // TODO need to refactor this once we have search support for cards.
      // For now we're just hardcoding a list of templates to load, and pretending
      // that the local store is the catalog.
      catalog: this.data.allCardsInStore(),
      templates: Promise.allSettled(cardTemplates.map(i => this.data.getCard(i, 'embedded'))),
    });
  }

  @action
  refreshModel() {
    this.refresh();
  }
}
