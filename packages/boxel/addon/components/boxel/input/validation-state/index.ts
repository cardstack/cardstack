import Component from '@glimmer/component';

export type InputValidationState = 'valid' | 'invalid' | 'loading' | 'initial';

interface ValidationStateInputArgs {
  state: InputValidationState;
  disabled: boolean;
}

export default class BoxelInputValidationState extends Component<ValidationStateInputArgs> {
  get icon(): string {
    if (this.args.disabled) {
      return '';
    }
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

  get isInvalid(): boolean {
    return this.args.state === 'invalid';
  }
}
