import type { TemplateOnlyComponent } from '@ember/component/template-only';
import ActionCardContainerTitle from './title';

import '@cardstack/boxel/styles/global.css';
import './index.css';


export interface Signature {
  Element: HTMLElement;
  Args: {
    dataTestId?: string;
    title?: string;
    icon?: string;
    imgUrl?: string;
  };
  Blocks: {
    'default': [],
  }
}

const ActionContainerSection: TemplateOnlyComponent<Signature> = <template>
  <section class="boxel-action-container-section" data-test-boxel-action-container-section={{@dataTestId}} ...attributes>
    {{#if @title}}
      <ActionCardContainerTitle @icon={{@icon}} @imgUrl={{@imgUrl}} @dataTestId={{@dataTestId}}>
        {{@title}}
      </ActionCardContainerTitle>
    {{/if}}

    {{yield}}
  </section>
</template>

export default ActionContainerSection