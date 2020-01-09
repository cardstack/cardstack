import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import ENV from '@cardstack/cardhost/config/environment';
import { Promise } from 'rsvp';

const { environment, cardTemplates = [] } = ENV;

export default class IndexRoute extends Route {
  @service data;
  @service cardLocalStorage;

  /** Get card ids from local storage, plus templates
   * and seed data, and return them from the model hook.
   * If a card is not found, remove it from local storage
   * and try again to render the page.
   */
  async model() {
    let ids = this.cardLocalStorage.getRecentCardIds();

    let recent = [];
    for (let id of ids) {
      recent.push(
        await this.data.getCard(id, 'embedded').catch(err => {
          // if there is a 404'd card in local storage, remove it
          if (err.message.includes('404')) {
            this.cardLocalStorage.removeRecentCardId(id);
            return null;
          } else {
            throw err;
          }
        })
      );
    }

    if (environment === 'development') {
      // prime the store with seed models
      recent.push(await this.data.getCard('local-hub::why-doors', 'embedded'));
    }

    return {
      catalog: recent.filter(Boolean),
      templates: await Promise.all(cardTemplates.map(i => this.data.getCard(i, 'embedded'))),
    };
  }

  @action
  refreshModel() {
    this.refresh();
  }

  @action
  error(err, transition) {
    // Check for error type before we retry, else fall back on automatic Ember behavior.
    // Without this, the page falls apart if a card is missing.
    if (err.message.includes('404')) {
      return transition.retry();
    }
  }
}
