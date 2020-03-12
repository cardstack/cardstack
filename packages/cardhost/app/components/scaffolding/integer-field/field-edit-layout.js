import BaseEditor from '../base-editor';
import { task } from 'ember-concurrency';
export default class IntegerFieldEditLayout extends BaseEditor {
  @(task(function*(value) {
    this.fieldValue = Number(value);
    yield this.args.setCardValue.perform(this.args.card.name, Number(value));
  }).restartable())
  updateFieldValue;
}
