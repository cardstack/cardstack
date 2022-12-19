import Component from '@glimmer/component';
import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    message?: string;
  }
}

export default class BoxelInputErrorMessage extends Component<Signature> {
  <template>
    <div class="boxel-input-error-message" aria-live="polite" data-test-boxel-input-error-message ...attributes>
      {{@message}}
    </div>
  </template>
}