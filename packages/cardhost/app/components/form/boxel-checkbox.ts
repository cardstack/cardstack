import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class BoxelTextField extends Component<{
  value: any;
  required: boolean;
  setValue: (value: any) => void;
}> {
  @tracked value = this.args.value;
  @tracked invalid = false;
  @tracked required = this.args.required || false;
  @tracked validationMessage!: string;

  @action
  handleInput({ target: { checked, validationMessage } }: any) {
    this.validationMessage = validationMessage;

    if (!checked && this.args.required) {
      this.validationMessage = 'This field is required';
      return;
    }

    if (!this.validationMessage && this.args.setValue) {
      this.args.setValue(checked);
    }
  }
}
