import Component from '@glimmer/component';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    title?: string;
  };
  Blocks: {
    default: [];
    footer: [];
  }
}

export default class NextStepsBox extends Component<Signature> {
  <template>
    <div class="boxel-next-steps-box" ...attributes>
      <header class="boxel-next-steps-box__header">
        <span class="boxel-next-steps-box__header-title">
          {{if @title @title "Suggested Next Steps"}}
        </span>
        <span class="boxel-next-steps-box__header-notice">
          Only visible to you
          {{svgJar "lock-filled" width="12px" height="12px"}}
        </span>
      </header>

      <div class="boxel-next-steps-box__content">
        {{#if (has-block)}}
          <div class="boxel-next-steps-box__button-container">
            {{yield}}
          </div>
        {{/if}}

        {{#if (has-block "footer")}}
          <footer class="boxel-next-steps-box__footer">
            {{yield to="footer"}}
          </footer>
        {{/if}}
      </div>
    </div>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::NextStepsBox': typeof NextStepsBox;
  }
}
