import Service from '@ember/service';

import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { task } from 'ember-concurrency';
import { restartableTask, enqueueTask } from 'ember-concurrency-decorators';
import { timeout } from 'ember-concurrency';
import ENV from '@cardstack/cardhost/config/environment';
import moment from 'moment';

const { autosaveDebounce, autosaveDisabled, environment } = ENV;
const AUTOSAVE_DEBOUNCE = 5000;

export default class AutosaveService extends Service {
  @service router;
  @service cardstackSession;
  @service cardLocalStorage;

  @tracked hasError;
  @tracked lastSavedTime = moment();

  // These are properties of the service so that we can change them to true for service-specific tests.
  autosaveDisabled = autosaveDisabled;
  autosaveDebounce = autosaveDebounce || AUTOSAVE_DEBOUNCE;

  // This task needs to be queued, otherwise we will get
  // 409 conflicts with the `/meta/version`
  @enqueueTask
  *saveCard(card) {
    this.statusMsg = null;

    try {
      yield card.save();
      // remove the next line once we have progressive data handling
      this.cardLocalStorage.addRecentCardId(card.id);
      this.hasError = false;
      this.lastSavedTime = moment();
    } catch (e) {
      this.handleSaveError(e, card);
      return;
    }
  }

  @restartableTask
  *debounceAndSave(card) {
    // The maximum frequency of save requests is enforced here
    yield timeout(this.autosaveDebounce);
    yield this.saveCard.perform(card);
  }

  @action
  kickoff(el, [isDirty, card]) {
    this.hasError = false; // if there's an error and a user switches cards, wipe out error state
    this.lastSavedTime = moment();

    if (environment === 'test') {
      this._card = card;
      return;
    }

    if (isDirty && !this.autosaveDisabled) {
      this.debounceAndSave.perform(card);
    }
  }

  @action
  _saveOnceInTests() {
    // This skips debouncing. Only use it for "click to save" type UI.
    this.saveCard.perform(this._card);
  }

  @action
  handleSaveError(e, card) {
    console.error(e); // eslint-disable-line no-console
    this.statusMsg = `card ${card.name} was NOT successfully created: ${e.message}`;
    this.hasError = true;
  }
}
