import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import BoxelInputSelectableTokenAmount, { SelectableToken } from './index';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import { fn } from '@ember/helper';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { cssVariable, CSSVariableInfo } from 'ember-freestyle/decorators/css-variable';

export default class BoxelSelectableInputTokenAmountUsage extends Component {
  tokens = [
    { name: 'CARD', icon: 'card' },
    { name: 'HI', icon: 'emoji' },
    { name: 'WORLD', icon: 'world' },
  ];

  @tracked id = 'boxel-input-selectable-token-amount-usage';
  @tracked value = '';
  @tracked helperText = 'Please enter an amount';
  @tracked errorMessage = '';
  @tracked disabled = false;
  @tracked invalid = false;
  @tracked icon = 'card';
  @tracked symbol = 'CARD';
  @tracked token = this.tokens[0];

  cssClassName = 'boxel-input-selectable-token-amount';
  @cssVariable declare boxelInputSelectableTokenAmountInputFontSize: CSSVariableInfo;

  @action set(amount: string): void {
    this.value = amount;
  }

  @action onBlur(): void {
    console.log('input blurred');
  }

  @action onChooseToken(token: SelectableToken) {
    this.token = token;
    console.log(token);
  }

  <template>
    <FreestyleUsage @name="Input::SelectableTokenAmount">
      <:example>
        <label for={{this.id}} class="boxel-sr-only">
          Label
        </label>
        <BoxelInputSelectableTokenAmount
          @id={{this.id}}
          @disabled={{this.disabled}}
          @value={{this.value}}
          @onInput={{this.set}}
          @invalid={{this.invalid}}
          @errorMessage={{this.errorMessage}}
          @helperText={{this.helperText}}
          @token={{this.token}}
          @tokens={{this.tokens}}
          @onChooseToken={{this.onChooseToken}}
          style={{cssVar
            boxel-input-selectable-token-amount-input-font-size=this.boxelInputSelectableTokenAmountInputFontSize.value
          }}
        />
      </:example>
      <:api as |Args|>
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
          @description="Action called when the input value changes"
        />
        <Args.Action
          @name="onChooseToken"
          @description="Action called when an item is chosen from the token dropdown"
        />
        <Args.String
          @name="value"
          @description="The value of the input"
          @value={{this.value}}
          @onInput={{fn (mut this.value)}}
        />
      </:api>
      <:cssVars as |Css|>
        <Css.Basic
          @name="boxel-input-selectable-token-amount-input-font-size"
          @type="dimension"
          @description="font size for the input element"
          @defaultValue={{this.boxelInputSelectableTokenAmountInputFontSize.defaults}}
          @value={{this.boxelInputSelectableTokenAmountInputFontSize.value}}
          @onInput={{this.boxelInputSelectableTokenAmountInputFontSize.update}}
        />
      </:cssVars>
    </FreestyleUsage>
  </template>
}
