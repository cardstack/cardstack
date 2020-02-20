import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import { task } from 'ember-concurrency';
import { A } from '@ember/array';
import ENV from '@cardstack/cardhost/config/environment';

const { environment } = ENV;

export default class Library extends Component {
  @service library;
  @service scroller;
  @service cardLocalStorage;
  @service data;

  @tracked selectedSection = 'recent-cards';
  @tracked cardModel;
  @tracked dialogTitle;
  @tracked showDialog;
  @tracked recentCards = A([]);

  constructor(...args) {
    super(...args);

    this.getRecentCardsTask.perform();
  }

  @task(function*() {
    let ids = this.cardLocalStorage.getRecentCardIds();

    let recent = [];

    for (let id of ids) {
      // unshift so that latest cards go to the front
      // Replace with datetime check in the future
      recent.unshift(
        yield this.data.getCard(id, 'embedded').catch(err => {
          // if there is a 404'd card in local storage, clear them
          if (err.message.includes('404')) {
            this.cardLocalStorage.clearIds();
            if (environment !== 'test') {
              // needed because otherwise the app remains in a broken state
              window.location.reload();
            }
          } else {
            throw err;
          }
        })
      );
    }

    if (environment === 'development') {
      // prime the store with seed models
      recent.push(yield this.data.getCard('local-hub::why-doors', 'embedded'));
    }

    this.recentCards = recent;
  })
  getRecentCardsTask;

  @action
  openCardNameDialog(title, model /*, evt*/) {
    if (arguments.length > 2) {
      this.cardModel = model;
    }
    if (arguments.length > 1) {
      this.dialogTitle = title;
    }
    this.showDialog = true;
  }

  @action
  closeDialog() {
    this.showDialog = false;
    this.cardModel = null;
  }

  @action
  scrollToSection(sectionId) {
    if (!sectionId) {
      return;
    }
    this.scroller.scrollToSection({
      selector: `.library-section--${sectionId}`,
      elementOffset: 60,
      doneScrolling: () => (this.selectedSection = sectionId),
    });
  }
}
