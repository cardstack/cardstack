import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import BoxelInputTokenSelect from './index';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import { fn } from '@ember/helper';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { cssVariable, CSSVariableInfo } from 'ember-freestyle/decorators/css-variable';
import { SelectableToken } from '../selectable-token';

export default class BoxelInputTokenSelectUsage extends Component {
  tokens = [
    { name: 'CARD', icon: 'card' },
    { name: 'HI', icon: 'emoji' },
    { name: 'WORLD', icon: 'world' },
  ];

  @tracked disabled = false;
  @tracked placeholder: string | undefined;
  @tracked value = this.tokens[0];

  cssClassName = 'boxel-input-token-select';
  @cssVariable declare boxelInputTokenSelectFontSize: CSSVariableInfo;


  @action onChooseToken(token: SelectableToken) {
    this.value = token;
    console.log(token);
  }

  <template>
    <FreestyleUsage @name="Input::TokenSelect">
      <:example>
        <BoxelInputTokenSelect
          @disabled={{this.disabled}}
          @value={{this.value}}
          @tokens={{this.tokens}}
          @onChooseToken={{this.onChooseToken}}
          style={{cssVar
            boxel-input-token-select-font-size=this.boxelInputTokenSelectFontSize.value
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
        <Args.String
          @name="placeholder"
          @description="Placeholder text when no token is selected"
          @defaultValue={{false}}
          @onInput={{fn (mut this.placeholder)}}
          @value={{this.placeholder}}
        />
        <Args.Action
          @name="onChooseToken"
          @description="Action called when an item is chosen from the dropdown"
        />
        <Args.Object
          @name="value"
          @description="The selected token"
          @value={{this.value}}
          @onInput={{fn (mut this.value)}}
        />
      </:api>
      <:cssVars as |Css|>
        <Css.Basic
          @name="boxel-input-token-select-font-size"
          @type="dimension"
          @description="font size for the input element"
          @defaultValue={{this.boxelInputTokenSelectFontSize.defaults}}
          @value={{this.boxelInputTokenSelectFontSize.value}}
          @onInput={{this.boxelInputTokenSelectFontSize.update}}
        />
      </:cssVars>
    </FreestyleUsage>
  </template>
}
