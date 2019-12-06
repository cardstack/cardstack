import BaseEditor from './base-editor';
import { action } from '@ember/object';
export default class DateEditor extends BaseEditor {
  @action
  updateFieldValue({ target: { value } }) {
    this.fieldValue = value;
    this.args.setFieldValue(value);
  }
}
