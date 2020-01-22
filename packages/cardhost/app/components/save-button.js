import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { task } from 'ember-concurrency';
import { restartableTask } from 'ember-concurrency-decorators';
import { timeout } from 'ember-concurrency';

const SAVED_HIGHLIGHT_DELAY = 2500;
const AUTOSAVE_DEBOUNCE = 1000;

export default class SaveButton extends Component {
  @service router;
  @service cardstackSession;
  @service cardLocalStorage;

  @tracked justSaved;

  @task(function*() {
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
  })
  saveCard;

  @task(function*() {
    let card = this.args.card;
    let cardIsNew = card.isNew;

    yield this.saveCard.perform();

    if (cardIsNew) {
      return this.router.transitionTo('cards.card.edit.fields.schema', card);
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
    yield timeout(AUTOSAVE_DEBOUNCE);
    this.saveCardWithState.perform();
  }

  @action
  save(element, [isDirty]) {
    if (isDirty) {
      if (this.args.clickAction) {
        this.args.clickAction();
      } else {
        this.debounceAndSave.perform();
      }
    }
  }
}
