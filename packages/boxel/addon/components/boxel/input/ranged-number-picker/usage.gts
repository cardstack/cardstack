import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelInputRangedNumberPicker from './index';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';

export default class BoxelInputRangedNumberPickerUsage extends Component {
  @tracked min = 1;
  @tracked max = 30;
  @tracked placeholder = '';
  @tracked icon: string | undefined;
  @tracked value: number | undefined;

  <template>
    <FreestyleUsage @name="Input::RangedNumberPicker">
      <:example>
        <BoxelInputRangedNumberPicker
          @min={{this.min}}
          @max={{this.max}}
          @value={{this.value}}
          @onChange={{fn (mut this.value)}}
          @icon={{this.icon}}
          @placeholder={{this.placeholder}}
        />
      </:example>
      <:api as |Args|>
        <Args.Number
          @name="min"
          @description="Minimum number to start range"
          @onInput={{fn (mut this.min)}}
          @value={{this.min}}
        />
        <Args.Number
          @name="max"
          @description="Maximum number to end range"
          @onInput={{fn (mut this.max)}}
          @value={{this.max}}
        />
        <Args.Number
          @name="value"
          @description="Currently selected value"
          @onInput={{fn (mut this.value)}}
          @value={{this.value}}
        />
        <Args.Action
          @name="onChange"
          @description="Action to call when a number is selected"
        />
        <Args.String
          @name="placeholder"
          @description="The value of the placeholder"
          @value={{this.placeholder}}
          @onInput={{fn (mut this.placeholder)}}
        />
        <Args.String
          @name="icon"
          @description="The icon to show in the trigger"
          @value={{this.icon}}
          @onInput={{fn (mut this.icon)}}
        />
      </:api>
    </FreestyleUsage>    
  </template>
}
