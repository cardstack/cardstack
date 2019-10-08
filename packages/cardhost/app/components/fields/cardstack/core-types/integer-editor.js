import BaseEditor from './base-editor';
import { action } from '@ember/object';
export default class IntegerEditor extends BaseEditor {

  @action
  updateFieldValue(value) {
    this.fieldValue = Number(value);
    this.args.setFieldValue(Number(value));
  }
}