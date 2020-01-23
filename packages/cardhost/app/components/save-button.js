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
const AUTOSAVE_DEBOUNCE = 1000;

export default class SaveButton extends Component {
  @service router;
  @service cardstackSession;
  @service cardLocalStorage;

  @tracked justSaved;

  autosaveDebounce = autosaveDebounce || AUTOSAVE_DEBOUNCE;
  autosaveDisabled = typeof this.args.autosaveDisabled === 'boolean' ? this.args.autosaveDisabled : !!autosaveDisabled;

  get cardIsNew() {
    let card = this.args.card;
    return card.isNew;
  }

  @enqueueTask
  *saveCard() {
    let card = this.args.card;
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

  @task(function*() {
    let cardIsNew = this.cardIsNew;

    yield this.saveCard.perform();

    if (cardIsNew) {
      return this.router.transitionTo('cards.card.edit.fields.schema', this.args.card);
    } else {
      this.justSaved = true;
      yield setTimeout(() => {
        this.justSaved = false;
      }, SAVED_HIGHLIGHT_DELAY);
    }
  })
  saveCardWithState;

  @restartableTask
  *debounceAndSave() {
    yield timeout(this.autosaveDebounce);
    this.saveCardWithState.perform();
  }

  @action
  autoSave(element, [isDirty]) {
    if (isDirty && !this.cardIsNew && !this.autosaveDisabled) {
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
