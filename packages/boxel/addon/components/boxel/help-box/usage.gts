/* eslint-disable no-console */
import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelHelpBox from './index';
import { fn } from '@ember/helper';
import { tracked } from '@glimmer/tracking';

export default class HelpBoxUsage extends Component {
  @tracked ctaText: string | undefined;
  @tracked prompt: string | undefined;
  @tracked url = 'mailto:support@cardstack.com';

  <template>
    <FreestyleUsage @name="HelpBox">
      <:description>
        Used for customer support purposes.
      </:description>
      <:example>
        <BoxelHelpBox
          @prompt={{this.prompt}}
          @buttonText={{this.ctaText}}
          @url={{this.url}}
        >
          More content here
        </BoxelHelpBox>
      </:example>
      <:api as |Args|>
        <Args.String
          @name="prompt"
          @optional={{true}}
          @defaultValue="Need help?"
          @value={{this.prompt}}
          @onInput={{fn (mut this.prompt)}}
        />
        <Args.String
          @name="buttonText"
          @optional={{true}}
          @defaultValue="Contact Support"
          @value={{this.ctaText}}
          @onInput={{fn (mut this.ctaText)}}
        />
        <Args.Object
          @name="url"
          @value={{this.url}}
          @description="Destination link for the button"
        />
        <Args.Yield
          @optional={{true}}
          @description="Space for additional content"
        />
      </:api>
    </FreestyleUsage>    
  </template>
}
