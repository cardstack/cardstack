import Component from '@glimmer/component';
import '@cardstack/boxel/styles/global.css';
import './index.css';

export type InputValidationState = 'valid' | 'invalid' | 'loading' | 'initial';

interface ValidationStateInputArgs {
  state: InputValidationState;
}

export default class BoxelValidationStateInput extends Component<ValidationStateInputArgs> {
  get icon(): string {
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
