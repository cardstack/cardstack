import BaseEditor from '../base-editor';
import { task } from 'ember-concurrency';
import { canonicalURLToCardId } from '@cardstack/hub';
import { isArray } from '@ember/array';

export default class BaseCardFieldEditLayout extends BaseEditor {
  constructor(...args) {
    super(...args);

    this.fieldInstructions = this.args.card.csDescription || 'Please enter card ID';
  }

  @(task(function*() {
    let relatedCard = yield this.args.card.enclosingCard.value(this.args.card.name);
    if (relatedCard) {
      if (isArray(relatedCard)) {
        this.fieldValue = relatedCard.map(card => card.canonicalURL);
      } else {
        this.fieldValue = relatedCard.canonicalURL;
      }
    } else {
      this.fieldValue = null;
    }
  }).drop())
  load;

  // This is super temporary--this will only fashion card as reference with arity of 1 for now..
  @(task(function*(value) {
    this.fieldValue = value;
    yield this.args.setCardReference.perform(this.args.card.name, value ? canonicalURLToCardId(value) : null);
  }).restartable())
  updateFieldValue;
}
