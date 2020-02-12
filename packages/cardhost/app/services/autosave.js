import Service from '@ember/service';

import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { task } from 'ember-concurrency';
import { restartableTask, enqueueTask } from 'ember-concurrency-decorators';
import { timeout } from 'ember-concurrency';
import ENV from '@cardstack/cardhost/config/environment';

const { autosaveDebounce, autosaveDisabled } = ENV;
const SAVED_HIGHLIGHT_DELAY = 2500;
const AUTOSAVE_DEBOUNCE = 5000;

export default class AutosaveService extends Service {
  @service router;
  @service cardstackSession;
  @service cardLocalStorage;

  @tracked justSaved;

  autosaveDebounce = autosaveDebounce || AUTOSAVE_DEBOUNCE;

  get cardIsNew() {
    let card = this.args.card;
    return card.isNew;
  }

  // This task needs to be queued, otherwise we will get
  // 409 conflicts with the `/meta/version`
  @enqueueTask
  *saveCard(card) {
    this.statusMsg = null;

    try {
      yield card.save();
      // remove the next line once we have progressive data handling
      this.cardLocalStorage.addRecentCardId(card.id);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      this.statusMsg = `card ${card.name} was NOT successfully created: ${e.message}`;
      return;
    }
  }

  @task(function*(card) {
    yield this.saveCard.perform(card);

    this.justSaved = true;

    yield setTimeout(() => {
      this.justSaved = false;
    }, SAVED_HIGHLIGHT_DELAY);
  })
  saveCardWithState;

  @restartableTask
  *debounceAndSave(card) {
    yield timeout(this.autosaveDebounce);
    this.saveCardWithState.perform(card);
  }

  @action
  initAutosave(el, [isDirty, card]) {
    if (isDirty && !autosaveDisabled) {
      this.debounceAndSave.perform(card);
    }
  }

  @action
  saveOnce() {
    this.saveCardWithState.perform();
  }
}

/*
initAutosave
in afterModel

finalAutosave
on willTransition for the route model

??? cancelSave

handleError

@tracked
hasError bool

*/
