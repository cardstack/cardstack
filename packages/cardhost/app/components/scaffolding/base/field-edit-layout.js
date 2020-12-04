import BaseEditor from '../base-editor';
import { task } from 'ember-concurrency';
import { canonicalURLToCardId } from '@cardstack/hub';

import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
// import { getUserRealm } from '../../../utils/scaffolding';

const size = 100;

export default class BaseCardFieldEditLayout extends BaseEditor {
  @service data;
  @tracked realmURL;
  @tracked displayInputField;

  constructor(...args) {
    super(...args);

    this.realmURL = 'https://builder-hub.stack.cards/api/realms/crd-records';
    // this.realmURL = getUserRealm();
    this.displayInputField = false;
    this.fieldInstructions = this.args.card.csDescription || 'Please enter card ID';
  }

  @action
  openCardSelector() {
    this.displayInputField = true;
  }

  @action
  closeCardSelector() {
    this.displayInputField = false;
  }

  @(task(function*() {
    let relatedCard = yield this.args.card.enclosingCard.value(this.args.card.name);
    if (relatedCard) {
      this.fieldValue = relatedCard;
    } else {
      this.fieldValue = null;
    }
  }).drop())
  load;

  @(task(function*(card) {
    if (this.args.card.csFieldArity === 'plural') {
      this.fieldValue = [...this.fieldValue, card];
    } else {
      this.fieldValue = card;
      this.displayInputField = false;
    }
    yield this.args.setCardReference.perform(this.args.card.name, this.fieldValue);
  }).restartable())
  updateFieldValue;

  @task(function*(value) {
    if (!value) {
      return;
    }

    let foundCards = yield this.data.search(
      {
        filter: {
          type: { csRealm: this.realmURL, csId: 'participant-template' },
        },
        sort: '-csCreated',
        page: { size },
      },
      { includeFieldSet: 'embedded' }
    );

    return foundCards.filter(a => a.attributes.title.toLowerCase().includes(value.toLowerCase()));
  })
  search;

  @task(function*(card) {
    if (this.args.card.csFieldArity === 'plural') {
      this.fieldValue = this.fieldValue.filter(el => card.csId !== el.csId);
    } else {
      this.fieldValue = null;
    }
    yield this.args.setCardReference.perform(this.args.card.name, this.fieldValue);
  })
  remove;
}
