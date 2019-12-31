import BaseEditor from './base-editor';
import { action } from '@ember/object';

export default class HasManyEditor extends BaseEditor {
  constructor(...args) {
    super(...args);

    if (this.args.field && this.args.field.value) {
      this.fieldValue = this.args.field.value.map(i => i.name).join(', ');
    }

    if (this.args.field.instructions) {
      this.fieldInstructions = this.args.field.instructions;
    } else {
      this.fieldInstructions = 'Please enter card IDs separated by commas';
    }
  }

  @action
  updateFieldValue(value) {
    value = value.split(',').map(i => i.trim());
    this.fieldValue = value;
    this.args.setFieldValue(value.map(i => `local-hub::${i}`));
  }
}
