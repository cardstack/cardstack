import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class BoxelTextField extends Component<{
  setValue: (value: any) => void;
}> {
  @tracked displayInputField = false;
  @tracked value!: any;

  @action
  toggleInputField() {
    this.displayInputField = !this.displayInputField;
  }

  @action
  handleInput({ target: { value } }: any) {
    this.value = value;

    if (this.args.setValue) {
      this.args.setValue(value);
    }
  }
}
