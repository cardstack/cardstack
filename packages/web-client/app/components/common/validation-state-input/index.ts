import Component from '@glimmer/component';

export type InputValidationState = 'valid' | 'invalid' | 'loading' | 'initial';

interface ValidationStateInputArgs {
  state: InputValidationState;
}

export default class ValidationStateInput extends Component<ValidationStateInputArgs> {
  get icon() {
    switch (this.args.state) {
      case 'valid':
        return 'success-bordered';
      case 'invalid':
        return 'failure-bordered';
      case 'loading':
        return 'loading-indicator';
      case 'initial':
        return '';
      default:
        return '';
    }
  }

  get isInvalid() {
    return this.args.state === 'invalid';
  }
}
