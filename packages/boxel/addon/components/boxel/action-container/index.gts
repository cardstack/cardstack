import type { TemplateOnlyComponent } from '@ember/component/template-only';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import BoxelHeader from '../header';
import BoxelActionChin, { type Signature as ActionChinSignature } from '../action-chin';
import cn from '@cardstack/boxel/helpers/cn';
import { on } from '@ember/modifier';
import optional from 'ember-composable-helpers/helpers/optional';
import { ComponentLike } from '@glint/template';
import ActionContainerSection, { type Signature as SectionSignature } from './section';
import or from 'ember-truth-helpers/helpers/or';

import '@cardstack/boxel/styles/global.css';
import './index.css';


interface Signature {
  Element: HTMLElement;
  Args: {
    isComplete?: boolean;
    disabled?: boolean;
    header?: string;
    prompt?: string;
    onClickButton?: () => void;
    completeActionLabel?: string;
    incompleteActionLabel?: string;
  };
  Blocks: {
    'default': [ComponentLike<SectionSignature>, ComponentLike<ActionChinSignature>],
  }
}

const ActionContainer: TemplateOnlyComponent<Signature> = <template>
  <BoxelCardContainer
    class={{cn
      "boxel-action-container"
      boxel-action-container--is-complete=@isComplete
    }}
    data-test-boxel-action-container
    data-test-boxel-action-container-is-complete={{@isComplete}}
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

    {{#if (or @completeActionLabel  @incompleteActionLabel)}}
      <BoxelActionChin
        class="boxel-action-container__footer"
        @state={{if @isComplete "memorialized" "default"}}
        data-test-boxel-action-footer
      >
        <:memorialized as |m|>
          <m.ActionButton @disabled={{@disabled}} {{on "click" (optional @onClickButton)}}>
            {{@completeActionLabel}}
          </m.ActionButton>
        </:memorialized>
        <:default as |a|>
          <a.ActionButton @disabled={{@disabled}} {{on "click" (optional @onClickButton)}}>
            {{@incompleteActionLabel}}
          </a.ActionButton>
        </:default>
      </BoxelActionChin>
    {{/if}}
          
  </BoxelCardContainer>
</template>

export default ActionContainer;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::ActionContainer': typeof ActionContainer;
  }
}
