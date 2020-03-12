import BaseEditor from '../base-editor';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';
import { action } from '@ember/object';

let nonce = 0;
export default class BooleanEditor extends BaseEditor {
  @tracked nonce;

  constructor(...args) {
    super(...args);
    this.nonce = nonce++;
  }

  get idPrefix() {
    return `edit-${this.args.card.name}-${this.nonce}-field-value`;
  }

  @task(function*() {
    yield this.load.last.finally();

    let checkedInput = document.getElementById(`${this.idPrefix}-${String(Boolean(this.fieldValue))}`);
    checkedInput.checked = true;
  })
  initialize;

  @action
  setChecked() {
    this.initialize.perform();
  }

  @(task(function*({ target: { id } }) {
    let value = id.includes('true');
    this.fieldValue = value;
    yield this.args.setCardValue.perform(this.args.card.name, value);
  }).restartable())
  updateFieldValue;
}
