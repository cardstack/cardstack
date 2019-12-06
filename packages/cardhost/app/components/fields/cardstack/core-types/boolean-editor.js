import BaseEditor from './base-editor';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

let nonce = 0;
export default class BooleanEditor extends BaseEditor {
  @tracked nonce;

  constructor(...args) {
    super(...args);
    this.nonce = nonce++;
  }

  get idPrefix() {
    return `edit-${this.args.field.name}-${this.nonce}-field-value`;
  }

  @action
  setChecked() {
    let checkedInput = document.getElementById(`${this.idPrefix}-${String(Boolean(this.fieldValue))}`);
    checkedInput.checked = true;
  }

  @action
  updateFieldValue({ target: { id } }) {
    let value = id.includes('true');
    this.fieldValue = value;
    this.args.setFieldValue(value);
  }
}
