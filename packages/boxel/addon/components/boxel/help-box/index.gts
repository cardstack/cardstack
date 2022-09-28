import type { TemplateOnlyComponent } from '@ember/component/template-only';
import BoxelButton from '../button';
import BoxelSidebarCardContainer from '../sidebar/card-container';
import or from 'ember-truth-helpers/helpers/or';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

import '@cardstack/boxel/styles/global.css';
import './index.css';


interface Signature {
  Element: HTMLDivElement;
  Args: {
    prompt?: string;
    buttonText?: string;
    url: string;
  };
  Blocks: {
    'default': [],
  }
}

const HelpBox: TemplateOnlyComponent<Signature> = <template>
  <BoxelSidebarCardContainer class="boxel-help-box" ...attributes>
    <header class="boxel-help-box__title">
      {{svgJar "help-circle" width="20px" height="20px" aria-hidden=true}}
      {{or @prompt "Need help?"}}
    </header>
    {{#if (has-block)}}
      <div>
        {{yield}}
      </div>
    {{/if}}
    <BoxelButton
      @as="anchor"
      @href={{@url}}
      @kind="secondary-light"
      class="boxel-help-box__button"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{or @buttonText "Contact Support"}}
    </BoxelButton>
  </BoxelSidebarCardContainer>
</template>;

export default HelpBox;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::HelpBox': typeof HelpBox;
  }
}
