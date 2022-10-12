import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import BoxelActionContainer from './index';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import { fn } from '@ember/helper';
import not from 'ember-truth-helpers/helpers/not';

export default class extends Component {
  @tracked isComplete = false;
  @tracked header = 'Card Header';
  @tracked incompleteActionLabel = 'Save';
  @tracked completeActionLabel = 'Edit value';
  <template>
    <FreestyleUsage @name="ActionContainer">
      <:description>
        Preconfigured CardContainer for an action card
      </:description>
      <:example>
        <BoxelActionContainer
          @header={{this.header}}
          @incompleteActionLabel={{this.incompleteActionLabel}}
          @completeActionLabel={{this.completeActionLabel}}
          @isComplete={{this.isComplete}}
          @onClickButton={{fn (mut this.isComplete) (not this.isComplete)}}
        as |Section|>
          {{!-- Sample block yield --}}
            <Section @title="A Section Title">
              <div>And some more content...</div>
            </Section>
          {{!-- End of sample block yield --}}
        </BoxelActionContainer>
      </:example>
      <:api as |Args|>
        <Args.String
          @name="header"
          @description="action card header/label"
          @onInput={{fn (mut this.header)}}
          @value={{this.header}}
        />
        <Args.String
          @name="incompleteActionLabel"
          @description="CTA button label for blocking action. It means the action is incomplete"
          @required={{true}}
          @onInput={{fn (mut this.incompleteActionLabel)}}
          @value={{this.incompleteActionLabel}}
        />
        <Args.String
          @name="completeActionLabel"
          @description="CTA button label for non-blocking action"
          @required={{true}}
          @onInput={{fn (mut this.completeActionLabel)}}
          @value={{this.completeActionLabel}}
        />
        <Args.Action
          @name="onClickButton"
          @description="Function for the CTA button action"
          @required={{true}}
        />
        <Args.Bool
          @name="isComplete"
          @description="Condition for action's completeness (Boolean)"
          @required={{true}}
          @defaultValue={{false}}
          @onInput={{fn (mut this.isComplete)}}
        />
        <Args.Yield
          @optional={{true}}
          @description="Unstyled area for custom card content and fields; yields a Section component that takes an optional title and applies an appropriate inset"
        />
      </:api>
    </FreestyleUsage>
  </template>
}
