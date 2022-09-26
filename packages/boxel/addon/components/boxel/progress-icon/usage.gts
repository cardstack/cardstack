import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelProgressIcon from './index';
import DarkThemeAndLightTheme from 'dummy/components/doc/dark-theme-and-light-theme';
import { fn } from '@ember/helper';

export default class extends Component {
  @tracked fractionComplete = 0.4;
  @tracked size = 24;
  @tracked isCancelled = false;
  @tracked isComplete = false;

  <template>
    <FreestyleUsage @name="ProgressIcon">
      <:example>
        <DarkThemeAndLightTheme>
          <BoxelProgressIcon
            @size={{this.size}}
            @isCancelled={{this.isCancelled}}
            @isComplete={{this.isComplete}}
            @fractionComplete={{this.fractionComplete}}
          />
        </DarkThemeAndLightTheme>
      </:example>

      <:api as |Args|>
        <Args.Number
          @name="size"
          @required={{true}}
          @min={{10}}
          @max={{60}}
          @description="the size of the circle, in px"
          @value={{this.size}}
          @onInput={{fn (mut this.size)}}
        />
        <Args.Number
          @name="fractionComplete"
          @defaultValue={{0}}
          @min={{0}}
          @max={{1}}
          @step={{0.1}}
          @description="completeness from 0 to 1"
          @value={{this.fractionComplete}}
          @onInput={{fn (mut this.fractionComplete)}}
        />
        <Args.Bool
          @name="isCancelled"
          @defaults={{false}}
          @description="when true shows an 'x' icon"
          @value={{this.isCancelled}}
          @onInput={{fn (mut this.isCancelled)}}
        />
        <Args.Bool
          @name="isComplete"
          @defaults={{false}}
          @description="when true shows a checkmark icon"
          @value={{this.isComplete}}
          @onInput={{fn (mut this.isComplete)}}
        />
      </:api>
    </FreestyleUsage>    
  </template>
}
