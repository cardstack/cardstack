import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class BaseEditor extends Component {
  @tracked fieldValue;

  constructor(...args) {
    super(...args);

    if (this.args.field && this.args.field.value) {
      this.fieldValue = this.args.field.value;
    }
  }

  @action
  updateFieldValue(value) {
    this.fieldValue = value;
    this.args.setFieldValue(value);
  }
}
