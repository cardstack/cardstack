import BaseEditor from '../base-editor';
import { task } from 'ember-concurrency';
import { canonicalURLToCardId } from '@cardstack/hub';

export default class BaseCardFieldEditLayout extends BaseEditor {
  constructor(...args) {
    super(...args);

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
    let val = value ? canonicalURLToCardId(value) : null;
    yield this.args.setCardReference.perform(this.args.card.name, val);
  }).restartable())
  updateFieldValue;

  @task(function*(value) {
    if (!value) {
      return;
    }
    yield this.args.setCardReference.perform(this.args.card.name, [...this.fieldValue, canonicalURLToCardId(value)]);
  })
  add;

  @task(function*(index) {
    if (this.args.card.csFieldArity === 'plural') {
      this.fieldValue = this.fieldValue.filter((el, i) => i !== index);
    } else {
      this.fieldValue = null;
    }
    yield this.args.setCardReference.perform(this.args.card.name, this.fieldValue);
  })
  remove;
}
