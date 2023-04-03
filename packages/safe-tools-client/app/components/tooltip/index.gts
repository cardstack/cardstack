import Component from '@glimmer/component';
import './index.css';

interface Signature {
  Element: HTMLAnchorElement | HTMLButtonElement;
  Args: {
  },
  Blocks: {
    'trigger': [],
    'content': [],
  };
}

export default class Tooltip extends Component<Signature> {
  <template>
    <div class="tooltip" data-test-tooltip>

      <div class="tooltip__trigger" data-test-tooltip-trigger>
        {{yield to="trigger"}}
      </div>

      <div class="tooltip__content" data-test-tooltip-content>
        {{yield to="content"}}
      </div>
    </div>
  </template>
}
