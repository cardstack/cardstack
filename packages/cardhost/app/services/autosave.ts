import Service from '@ember/service';

import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
//@ts-ignore
import { timeout, task } from 'ember-concurrency';
import { set } from '@ember/object';
//@ts-ignore
import ENV from '@cardstack/cardhost/config/environment';
import DataService from './data';
import { Model } from '../routes/cards/card';
import { AddressableCard } from '@cardstack/hub';

const { autosaveDebounce, autosaveDisabled, environment } = ENV;
const AUTOSAVE_DEBOUNCE = 5000;

type CardUpdateFn = (updatedCard: AddressableCard, isDirty: boolean) => void;

export default class AutosaveService extends Service {
  @service data!: DataService;
  @tracked model!: Model;
  @tracked hasError = false;
  @tracked statusMsg: string | undefined;
  private cardUpdatedFn: CardUpdateFn | undefined;

  // These are properties of the service so that we can change them to true for service-specific tests.
  autosaveDisabled = autosaveDisabled;
  autosaveDebounce = autosaveDebounce || AUTOSAVE_DEBOUNCE;

  @(task(function*(this: AutosaveService, model: Model) {
    if (this.debounceAndSave.isRunning && this.saveCard.isIdle) {
      this.debounceAndSave.last.cancel();
      yield this.saveCard.perform();
      this.model = model;
    } else if (this.debounceAndSave.isRunning && this.saveCard.isRunning) {
      yield this.saveCard.last.then();
      this.model = model;
    } else {
      this.model = model;
    }
  }).enqueue())
  setCardModel: any; // TS and EC don't play nice

  bindCardUpdated(cardUpdatedFn: CardUpdateFn) {
    this.cardUpdatedFn = cardUpdatedFn;
  }

  cardUpdated(updatedCard: AddressableCard, isDirty = false) {
    if (typeof this.cardUpdatedFn === 'function') {
      this.cardUpdatedFn(updatedCard, isDirty);
    }
    this.kickoff();
  }

  get isDirty() {
    return this.model?.isDirty;
  }

  get card(): AddressableCard | undefined {
    return this.model?.card;
  }

  // This task needs to be queued, otherwise we will get
  // 409 conflicts with the `/meta/version`
  @(task(function*(this: AutosaveService) {
    this.statusMsg = undefined;

    let savedCard;
    try {
      if (!this.card) {
        throw new Error(`autosave service was never initialized with a card model when card route was entered`);
      }
      savedCard = yield this.data.save(this.card);
    } catch (e) {
      console.error(e); // eslint-disable-line no-console
      this.hasError = true;
      this.statusMsg = `card ${this.card?.csTitle} was NOT successfully created: ${e.message}`;
      return;
    }

    if (typeof this.cardUpdatedFn === 'function') {
      this.cardUpdatedFn(savedCard, false);
    }

    // Make sure queued card saves have latest version number
    set(this.model, 'card', yield this.card.patch({ data: { type: 'cards', meta: savedCard.meta } })); // This is not ideal, please save us orbit...
  }).enqueue())
  saveCard: any; // TS and EC don't mix very well...

  @(task(function*(this: AutosaveService) {
    yield this.setCardModel.last.then();
    // The maximum frequency of save requests is enforced here
    yield timeout(this.autosaveDebounce);
    yield this.saveCard.perform();
  }).restartable())
  debounceAndSave: any; // TS and EC don't play nicely

  @action
  kickoff() {
    this.hasError = false; // if there's an error and a user switches cards, wipe out error state

    if (environment === 'test' && this.autosaveDisabled) {
      return;
    }

    if (this.cardUpdated && this.card && this.isDirty && !this.autosaveDisabled) {
      this.debounceAndSave.perform();
    }
  }
}
