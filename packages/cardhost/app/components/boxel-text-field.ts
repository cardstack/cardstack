import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class BoxelTextField extends Component {
  @tracked displayInputField = false;

  @action
  toggleInputField() {
    this.displayInputField = !this.displayInputField;
  }
}
