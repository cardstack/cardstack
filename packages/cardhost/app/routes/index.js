import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import ENV from '@cardstack/cardhost/config/environment';
import { hash } from 'rsvp';
import { restartableTask } from 'ember-concurrency-decorators';

const { environment, cardTemplates = [] } = ENV;

export default class IndexRoute extends Route {
  @service data;
  @service cardLocalStorage;

  async model() {
    let ids = this.cardLocalStorage.getRecentCardIds();

    let cards = [];
    if (environment === 'development') {
      // prime the store with seed models
      let defaults = await this.data.getCard('local-hub::why-doors', 'embedded');
      cards.push(defaults);
    }

    // come back to handle this better for async
    // ids.forEach(id => {
    let recent;
    try {
      recent = await this.data.getCard(ids[0], 'embedded');
      if (recent) cards.push(recent);
    } catch (err) {
      console.log('fail', err);
    }
    // });

    // let resolvedAndRejectedCards = await this.data.allCardsInStore();
    // let catalog = resolvedAndRejectedCards.filter(card => card !== undefined);

    return await hash({
      // TODO need to refactor this once we have search support for cards.
      // For now we're just hardcoding a list of templates to load, and pretending
      // that the local store is the catalog.
      catalog: cards,
      templates: Promise.all(cardTemplates.map(i => this.data.getCard(i, 'embedded'))),
    });
  }

  @action
  refreshModel() {
    this.refresh();
  }
}
