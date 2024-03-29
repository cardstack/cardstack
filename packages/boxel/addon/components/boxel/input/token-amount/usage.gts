import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelInputTokenAmount from './index';

import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { fn } from '@ember/helper';

export default class BoxelInputTokenAmountUsage extends Component {
  @tracked id = 'boxel-token-amount-input-usage';
  @tracked value = '';
  @tracked helperText = 'Please enter an amount';
  @tracked errorMessage = '';
  @tracked disabled = false;
  @tracked invalid = false;
  @tracked icon = 'card';
  @tracked symbol = 'CARD';

  @action set(amount: string): void {
    this.value = amount;
  }

  <template>
    <FreestyleUsage @name="Input::TokenAmount">
      <:example>
        <label for={{this.id}} class="boxel-sr-only">Label</label>
        <BoxelInputTokenAmount
          @icon={{this.icon}}
          @symbol={{this.symbol}}
          @id={{this.id}}
          @disabled={{this.disabled}}
          @value={{this.value}}
          @onInput={{this.set}}
          @invalid={{this.invalid}}
          @errorMessage={{this.errorMessage}}
          @helperText={{this.helperText}}
        />
      </:example>
      <:api as |Args|>
        <Args.String
          @name="icon"
          @description="The token icon to display to the left of the input"
          @onInput={{fn (mut this.icon)}}
          @value={{this.icon}}
        />
        <Args.String
          @name="symbol"
          @description="The token symbol to display to the right of the input"
          @onInput={{fn (mut this.symbol)}}
          @value={{this.symbol}}
        />
        <Args.String
          @name="id"
          @description="The id of the input"
          @onInput={{fn (mut this.id)}}
          @value={{this.id}}
        />
        <Args.Bool
          @name="disabled"
          @description="Whether the input is disabled"
          @defaultValue={{false}}
          @onInput={{fn (mut this.disabled)}}
          @value={{this.disabled}}
        />
        <Args.Bool
          @name="invalid"
          @description="Whether the input is invalid"
          @defaultValue={{false}}
          @onInput={{fn (mut this.invalid)}}
          @value={{this.invalid}}
        />
        <Args.String
          @name="helperText"
          @description="Helper message to display below the input"
          @value={{this.helperText}}
          @onInput={{fn (mut this.helperText)}}
        />
        <Args.String
          @name="errorMessage"
          @description="Error message to display when the input is invalid"
          @value={{this.errorMessage}}
          @onInput={{fn (mut this.errorMessage)}}
        />
        <Args.Action
          @name="onInput"
          @description="Action to call when the input value changes"
        />
        <Args.String
          @name="value"
          @description="The value of the input"
          @value={{this.value}}
          @onInput={{fn (mut this.value)}}
        />
      </:api>
    </FreestyleUsage>    
  </template>
}
