import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import { task } from 'ember-concurrency';
import { A } from '@ember/array';

export default class Library extends Component {
  @service library;
  @service scroller;

  @tracked selectedSection = 'recent-cards';
  @tracked cardModel;
  @tracked dialogTitle;
  @tracked showDialog;
  @tracked recentCards = A([]);

  @service cardLocalStorage;
  @service data;

  constructor(...args) {
    super(...args);

    let ids = this.cardLocalStorage.getRecentCardIds();
    this.getRecentCardsTask.perform(ids);
  }

  @task(function*(ids) {
    let recents = [];

    for (let id of ids) {
      let card = yield this.data.getCard(id, 'embedded');
      recents.push(card);
    }

    this.recentCards = recents;
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
