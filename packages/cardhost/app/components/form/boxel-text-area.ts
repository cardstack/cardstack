import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class BoxelTextArea extends Component<{
  value: any;
  required: boolean;
  setValue: (value: any) => void;
  rows: number;
}> {
  @tracked value = this.args.value;
  @tracked invalid = false;
  @tracked required = this.args.required || false;
  @tracked validationMessage!: string;
  @tracked rows = this.args.rows || 3;

  @action
  handleInput({ target: { value, validationMessage, title } }: any) {
    this.value = value;

    if (!value && this.required) {
      this.invalid = true;
      this.validationMessage = 'This field is required';
      return;
    }

    if (validationMessage) {
      this.invalid = true;
      this.validationMessage = title || validationMessage;
    } else {
      this.invalid = false;
      this.validationMessage = '';
    }

    if (!this.invalid && this.args.setValue) {
      this.args.setValue(value);
    }
  }
}
