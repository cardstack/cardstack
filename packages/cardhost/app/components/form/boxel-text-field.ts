import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { timeout } from 'ember-concurrency';
import { restartableTask } from 'ember-concurrency-decorators';
// @ts-ignore
import ENV from '@cardstack/cardhost/config/environment';

const debounceMs = ENV.debounceMs ? ENV.debounceMs : 500;

export default class BoxelTextField extends Component<{
  value: any;
  required: boolean;
  setValue: (value: any) => void;
  addAction: (value: any) => void;
  debounceMs: number;
}> {
  @tracked displayInputField = false;
  @tracked value = this.args.value;
  @tracked invalid = false;
  @tracked required = this.args.required || false;
  @tracked validationMessage!: string;

  // Set default debounce in milliseconds.
  // This limits how often handleInput is called.
  get debounceMs() {
    let ms = this.args.debounceMs;
    return ms !== undefined ? this.args.debounceMs : debounceMs;
  }

  @action
  inputEvent(evt: Event) {
    if (this.debounceMs === 0) {
      this.handleInput(evt);
    } else {
      // @ts-ignore
      this.debouncedHandleInput.perform(evt);
    }
  }

  @restartableTask
  *debouncedHandleInput(evt: Event) {
    yield timeout(this.debounceMs);
    this.handleInput(evt);
  }

  @action
  toggleInputField() {
    this.displayInputField = !this.displayInputField;
  }

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

  @action
  resetField() {
    this.value = null;
  }
}
