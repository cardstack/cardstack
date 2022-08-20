import Component from '@glimmer/component';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

interface ActionChinSignature {
  Element: HTMLDivElement;
  Args: {
    icon: string;
  };
  Blocks: {
    default: [];
  }
}

export default class ActionChin extends Component<ActionChinSignature> {
  <template>
    <div class="boxel-action-chin__action-status-area" ...attributes data-test-boxel-action-chin-action-status-area>
      {{#if @icon}}
        {{svgJar @icon class="boxel-action-chin__action-status-area-icon" width="20" height="20" role="presentation"}}
      {{/if}}
      {{yield}}
    </div>
  </template>
}