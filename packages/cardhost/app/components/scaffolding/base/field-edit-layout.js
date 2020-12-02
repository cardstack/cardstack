import BaseEditor from '../base-editor';
import { task } from 'ember-concurrency';
import { canonicalURLToCardId } from '@cardstack/hub';

import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { getUserRealm } from '../../../utils/scaffolding';

const size = 100;

export default class BaseCardFieldEditLayout extends BaseEditor {
  @service data;
  @tracked realmURL;

  constructor(...args) {
    super(...args);

    this.realmURL = getUserRealm();
    this.fieldInstructions = this.args.card.csDescription || 'Please enter card ID';
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

  // This is super temporary--this will only fashion card as reference with arity of 1 for now..
  @(task(function*(value) {
    yield this.args.setCardReference.linked().perform(this.args.card.name, value ? canonicalURLToCardId(value) : null);
  }).restartable())
  updateFieldValue;

  @task(function*(value) {
    // TODO: fix
    if (!value) {
      return;
    }
    let val = canonicalURLToCardId(value);
    yield this.args.setCardReference.perform(this.args.card.name, [...this.fieldValue, val]);
  })
  add;

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

  @task(function*(index) {
    // TODO: fix
    if (this.args.card.csFieldArity === 'plural') {
      this.fieldValue = this.fieldValue.filter((el, i) => i !== index);
    } else {
      this.fieldValue = null;
    }
    // yield this.args.setCardReference.perform(this.args.card.name, this.fieldValue);
  })
  remove;
}
