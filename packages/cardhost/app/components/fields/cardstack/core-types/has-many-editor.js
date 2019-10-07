import BaseEditor from './base-editor';
import { action } from '@ember/object';

export default class HasManyEditor extends BaseEditor {

  constructor(...args) {
    super(...args);

    if (this.args.field && this.args.field.value) {
      this.fieldValue = this.args.field.value.map(i => i.id).join(',');
    }
  }

  @action
  updateFieldValue(value) {
    value = value.split(',').map(i => i.trim());
    this.fieldValue = value;
    this.args.setFieldValue(value);
  }
}