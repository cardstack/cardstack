import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class ValidationStateInputUsageComponent extends Component {
  @tracked value = '';
  @tracked state = 'default';
  @tracked helperText = 'Please enter a value';
  @tracked errorMessage = '';

  @action set(val: string): void {
    this.value = val;
    if (!val) {
      this.state = 'invalid';
    } else {
      this.state = 'valid';
    }
  }

  @action validate(ev: Event): void {
    let target = ev.target as HTMLInputElement;
    if (!target.validity?.valid) {
      this.state = 'invalid';
      if (target.validity?.valueMissing) {
        this.errorMessage = 'This is a required field';
      } else {
        this.errorMessage = target.validationMessage;
      }
      return;
    }
    this.state = 'valid';
    this.errorMessage = '';
  }
}
