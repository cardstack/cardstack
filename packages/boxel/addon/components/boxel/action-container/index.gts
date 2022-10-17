import type { TemplateOnlyComponent } from '@ember/component/template-only';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import BoxelHeader from '../header';
import BoxelActionChin, { type Signature as ActionChinSignature } from '../action-chin';
import cn from '@cardstack/boxel/helpers/cn';
import { ComponentLike } from '@glint/template';
import ActionContainerSection, { type Signature as SectionSignature } from './section';

import '@cardstack/boxel/styles/global.css';
import './index.css';


interface Signature {
  Element: HTMLElement;
  Args: {
    header?: string;
  };
  Blocks: {
    'default': [ComponentLike<SectionSignature>, ComponentLike<ActionChinSignature>],
  }
}

const ActionContainer: TemplateOnlyComponent<Signature> = <template>
  <BoxelCardContainer
    class={{cn
      "boxel-action-container"
    }}
    data-test-boxel-action-container
    ...attributes
  >
    {{#if @header}}
      <BoxelHeader
        class="boxel-action-container__header"
        @header={{@header}}
        data-test-boxel-action-header
      />
    {{/if}}

    {{yield (component ActionContainerSection) (component BoxelActionChin class='boxel-action-container__footer')}}
          
  </BoxelCardContainer>
</template>

export default ActionContainer;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::ActionContainer': typeof ActionContainer;
  }
}
