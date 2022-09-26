import type { TemplateOnlyComponent } from '@ember/component/template-only';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import cn from '@cardstack/boxel/helpers/cn';

import BoxelHeader from '../header';

interface Signature {
  Element: HTMLElement;
  Args: {
    header?: string;
    isHighlighted?: boolean;
    displayBoundaries?: boolean;
  };
  Blocks: {
    'default': [],
    'header': [],
  };
}

const CardContainer: TemplateOnlyComponent<Signature> = <template>
  <article class={{cn
      "boxel-card-container"
      boxel-card-container--highlighted=@isHighlighted
      boxel-card-container--boundaries=@displayBoundaries
    }}
    data-test-boxel-card-container
    ...attributes
  >
    {{#if (has-block "header")}}
      <BoxelHeader @header={{@header}}>
        {{yield to="header"}}
      </BoxelHeader>
    {{/if}}

    {{yield}}
  </article>
</template>;
export default CardContainer;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::CardContainer': typeof CardContainer;
  }
}
