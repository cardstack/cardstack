import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';

// This is just a super simplistic field editor for
// cardstack core types. I would expect this to eventually
// get phased out for something a bit more extensible.

let nonce = 0;

export default class FieldEditor extends Component {
  @tracked fieldValue = {};
  @tracked myId;
  @tracked nonce;

  constructor(...args) {
    super(...args);
    this.nonce = nonce++;
    if (this.initialValue != null) {
      this.fieldValue[this.fieldName] = this.initialValue;
    }
  }

  get size() {
    return this.args.inputSize || 30;
  }

  get fieldName() {
    if (!this.args.field) { return null; }
    return this.args.field.fieldName;
  }

  get fieldType() {
    if (!this.args.field) { return null; }
    return this.args.field.fieldType;
  }

  get initialValue() {
    if (!this.args.field) { return null; }
    return this.args.field.fieldValue;
  }

  get displayType() {
    let type = this.args.field.fieldType.split('::').pop();
    switch (type) {
      case 'case-insensitive':
        return 'case-insensitive string';
      case 'has-many':
        return 'related cards';
      case 'belongs-to':
        return 'related card';
    }
    return type;
  }

  @action
  updateFieldValue(value) {
    set(this.fieldValue, this.fieldName, value);
    this.args.onUpdate(value);
  }

  @action
  updateDateFieldValue({ target: { value }}) {
    set(this.fieldValue, this.fieldName, value);
    this.args.onUpdate(value);
  }

  @action
  updateBooleanFieldValue({ target: { id }}) {
    let value = id.includes('true');
    set(this.fieldValue, this.fieldName, value);
    this.args.onUpdate(value);
  }

  @action
  updateCardsFieldValue(value) {
    value = value.split(',');
    set(this.fieldValue, this.fieldName, value);
    this.args.onUpdate(value);
  }
}