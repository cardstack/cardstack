/* eslint-disable no-console */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelLoadingIndicator from './index';
import { fn } from '@ember/helper';

export default class LoadingIndicatorUsage extends Component {
  @tracked color = '#000';

  <template>
    <FreestyleUsage @name="Loading Indicator" @description="Default loading indicator for Boxel components.">
      <:example>
        <BoxelLoadingIndicator 
          class="loading-indicator-usage__example" 
          @color={{this.color}}
        />
      </:example>
      <:api as |Args|>
        <Args.String
          @name="color"
          @description="The color of the loading indicator"
          @value={{this.color}}
          @onInput={{fn (mut this.color)}}
          @default="black"
        />
      </:api>
    </FreestyleUsage>
  </template>
}
