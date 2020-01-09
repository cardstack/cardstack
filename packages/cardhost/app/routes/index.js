import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import ENV from '@cardstack/cardhost/config/environment';
import { hash } from 'rsvp';
import { restartableTask } from 'ember-concurrency-decorators';
import { Promise } from 'rsvp';

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

    let recent = [];
    for (let id of ids) {
      recent.push(
        this.data.getCard(id, 'embedded').catch(err => {
          // if err is 404, return null
          // then filter on null
          console.log(err);
          // TODO handle removing specific ID
          localStorage.setItem('recentCardIds', JSON.stringify([]));
          // can probably remove this if we remove Boolean
          return null;
        })
      );
    }

    debugger;
    return {
      // TODO need to refactor this once we have search support for cards.
      // For now we're just hardcoding a list of templates to load, and pretending
      // that the local store is the catalog.
      // see if we can get rid of this filter, since we check for things on error
      catalog: (await Promise.all(recent)).filter(Boolean),
      templates: await Promise.all(cardTemplates.map(i => this.data.getCard(i, 'embedded'))),
    };
  }

  @action
  refreshModel() {
    this.refresh();
  }

  @action
  error(err, transition) {
    // check for error type before we retry
    console.log(err);
    transition.retry();
  }
}
