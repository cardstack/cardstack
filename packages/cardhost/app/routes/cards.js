import Route from '@ember/routing/route';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import ENV from '@cardstack/cardhost/config/environment';

const { environment, cardTemplates = [] } = ENV;

export default class CardsRoute extends Route {
  @service data;
  @service cardLocalStorage;
  @service library;

  async model() {
    // let ids = this.cardLocalStorage.getRecentCardIds();

    // let recent = [];
    // for (let id of ids) {
    //   // unshift so that latest cards go to the front
    //   // Replace with datetime check in the future
    //   recent.unshift(
    //     await this.data.getCard(id, 'embedded').catch(err => {
    //       // if there is a 404'd card in local storage, clear them
    //       if (err.message.includes('404')) {
    //         this.cardLocalStorage.clearIds();
    //         if (environment !== 'test') {
    //           // needed because otherwise the app remains in a broken state
    //           window.location.reload();
    //         }
    //       } else {
    //         throw err;
    //       }
    //     })
    //   );
    // }

    // if (environment === 'development') {
    //   // prime the store with seed models
    //   recent.push(await this.data.getCard('local-hub::why-doors', 'embedded'));
    // }

    return {
      // catalog: recent.filter(Boolean),
      templates: await Promise.all(cardTemplates.map(i => this.data.getCard(i, 'embedded'))),
    };
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
