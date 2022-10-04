import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelSelectButton from './index';
import DarkThemeAndLightTheme from 'dummy/components/doc/dark-theme-and-light-theme';
import { on } from '@ember/modifier';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { array, fn } from '@ember/helper';

import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class extends Component {
  @tracked isPartial = false;
  @tracked isSelected = false;
  @tracked mode = 'view';

  @action onClick(): void {
    if (this.isSelected) {
      this.isSelected = false;
    } else if (this.isPartial) {
      this.isPartial = false;
    } else {
      this.isPartial = true;
      this.isSelected = true;
    }
  }

  <template>
    <FreestyleUsage @name="SelectButton">
      <:example>
        <DarkThemeAndLightTheme>
          <BoxelSelectButton
            @isPartial={{this.isPartial}}
            @isSelected={{this.isSelected}}
            @mode={{this.mode}}
            {{on "click" this.onClick}}
          />
        </DarkThemeAndLightTheme>
      </:example>

      <:api as |Args|>
        <Args.Bool
          @name="isPartial"
          @value={{this.isPartial}}
          @description="when true, renders in its partially selected state"
          @defaultValue={{false}}
          @onInput={{fn (mut this.isPartial)}}
        />
        <Args.Bool
          @name="isSelected"
          @value={{this.isSelected}}
          @description="when true, renders in its fully selected state, takes precedence over isPartial if both are true"
          @defaultValue={{false}}
          @onInput={{fn (mut this.isSelected)}}
        />
        <Args.String
          @name="mode"
          @value={{this.mode}}
          @description="which card mode are we in"
          @options={{array "view" "edit" "configure"}}
          @onInput={{fn (mut this.mode)}}
        />
      </:api>
    </FreestyleUsage>    
  </template>
}
