import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import BoxelInputSelectableTokenAmount from './index';
import { SelectableToken } from '../selectable-token';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import { fn } from '@ember/helper';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { cssVariable, CSSVariableInfo } from 'ember-freestyle/decorators/css-variable';

export default class BoxelSelectableInputTokenAmountUsage extends Component {
  tokens: SelectableToken[] = [
     { name: 'Cardstack', logoURI: 'card', symbol: 'CARD', decimals: 18, address: "0x954b890704693af242613edEf1B603825afcD708" },
    {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      logoURI: "https://assets-cdn.trustwallet.com/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png"
    },
    {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      name: "WETH",
      symbol: "WETH",
      decimals: 18,
      logoURI: "https://assets-cdn.trustwallet.com/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png"
    },
    {
      name: "MASQ",
      symbol: "MASQ",
      address: "0xee9a352f6aac4af1a5b9f467f6a93e0ffbe9dd35",
      decimals: 18,
      logoURI: "https://github.com/MASQ-Project/MASQ-contract/raw/master/MASQ%20Logo%20Blue%20Solo%20Transparent.png",
    },
  ];

  @tracked id = 'boxel-input-selectable-token-amount-usage';
  @tracked value = '';
  @tracked helperText = 'Please enter an amount';
  @tracked errorMessage = '';
  @tracked disabled = false;
  @tracked invalid = false;
  @tracked searchEnabled = false;
  @tracked icon = 'card';
  @tracked symbol = 'CARD';
  @tracked token: SelectableToken | undefined;

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
          @searchEnabled={{this.searchEnabled}}
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
        <Args.String
          @name="value"
          @description="The value of the input"
          @value={{this.value}}
          @onInput={{fn (mut this.value)}}
        />
        <Args.Object
          @name="token"
          @description="The selected token"
          @value={{this.token}}
          hideControls={{true}}
        />
        <Args.Object
          @name="tokens"
          @description="The available token list"
          @value={{this.tokens}}
          @hideControls={{true}}
        />
        <Args.Bool
          @name="searchEnabled"
          @description="Whether the select menu has a search field"
          @defaultValue={{false}}
          @onInput={{fn (mut this.searchEnabled)}}
          @value={{this.searchEnabled}}
        />
        <Args.Action
          @name="onInput"
          @description="Action called when the input value changes"
        />
        <Args.Action
          @name="onChooseToken"
          @description="Action called when an item is chosen from the token dropdown"
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
