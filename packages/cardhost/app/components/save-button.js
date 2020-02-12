import Component from '@glimmer/component';
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

export default class SaveButton extends Component {
  @service data;
  @service cardstackSession;

  @tracked justSaved;

  autosaveDebounce = autosaveDebounce || AUTOSAVE_DEBOUNCE;
  autosaveDisabled = typeof this.args.autosaveDisabled === 'boolean' ? this.args.autosaveDisabled : !!autosaveDisabled;

  // This task needs to be queued, otherwise we will get
  // 409 conflicts with the `/meta/version`
  @enqueueTask
  *saveCard() {
    let card = this.args.card;
    this.statusMsg = null;

    try {
      let savedCard = yield this.data.save(card);
      this.args.updateCard(savedCard, false);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      this.statusMsg = `card ${card.csTitle} was NOT successfully created: ${e.message}`;
      return;
    }
  }

  @task(function*() {
    yield this.saveCard.perform();

    this.justSaved = true;

    yield setTimeout(() => {
      this.justSaved = false;
    }, SAVED_HIGHLIGHT_DELAY);
  })
  saveCardWithState;

  @restartableTask
  *debounceAndSave() {
    yield timeout(this.autosaveDebounce);
    this.saveCardWithState.perform();
  }

  @action
  autoSave() {
    if (this.args.isDirty && !this.autosaveDisabled) {
      if (this.args.clickAction) {
        this.args.clickAction();
      } else {
        this.debounceAndSave.perform();
      }
    }
  }

  @action
  save() {
    if (this.args.clickAction) {
      this.args.clickAction();
    } else {
      this.saveCardWithState.perform();
    }
  }
}
