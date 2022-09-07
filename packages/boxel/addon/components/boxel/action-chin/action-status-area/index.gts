import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import Component from '@glimmer/component';

export interface StatusAreaSignature {
  Element: HTMLDivElement;
  Args: {
    icon?: string;
  };
  Blocks: {
    'default': [],
  }
}

export default class StatusArea extends Component<StatusAreaSignature> {
  <template>
    <div class="boxel-action-chin__action-status-area" ...attributes data-test-boxel-action-chin-action-status-area>
      {{#if @icon}}
        {{svgJar @icon class="boxel-action-chin__action-status-area-icon" width="20" height="20" role="presentation"}}
      {{/if}}
      {{yield}}
    </div>
  </template>
}

