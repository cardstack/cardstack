import Component from '@glimmer/component';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import BoxelInput from '../index';
import BoxelSelect from '../../select';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import { fn } from '@ember/helper';

interface Signature {
  Element: HTMLElement;
  Args: {
    value?: string;
    disabled: boolean;
    helperText?: string;
    invalid: boolean;
    errorMessage: string;
    onBlur: () => {};
    onInput: () => {};
    onChooseToken: () => {};
    token: Token;
    tokens: Token[];
  };
  Blocks: {
    'default': [],
  }
}

interface Token {
  name: string;
  icon: string;
}

export default class SelectableTokenAmount extends Component<Signature> {
  <template>
    <div class="boxel-selectable-token-amount-input-group" ...attributes>
      <BoxelInput
        class="boxel-selectable-token-amount-input-group__input"
        @id={{@id}}
        @value={{@value}}
        @required={{unless @disabled true}}
        @onInput={{@onInput}}
        @onBlur={{fn @onInput @value}}
        @invalid={{unless @disabled @invalid}}
        @errorMessage={{@errorMessage}}
        @helperText={{@helperText}}
        @disabled={{@disabled}}
        placeholder="0.00"
        autocomplete="off"
        inputmode="decimal"
      />
      <BoxelSelect
        class="boxel-selectable-token-amount-input__select"
        @options={{@tokens}}
        @selected={{@token}}
        @disabled={{@disabled}}
        @onChange={{@onChooseToken}}
        @dropdownClass="boxel-selectable-token-amount-input-group__dropdown"
        @verticalPosition="below" as |item itemCssClass|
      >
        <div class="{{itemCssClass}} boxel-selectable-token-amount-input-group__dropdown-item">
          {{svgJar
            item.icon
            class="boxel-selectable-token-amount-input-group__icon"
            role="presentation"
          }}

          {{item.name}}
        </div>
      </BoxelSelect>
    </div>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Input::SelectableTokenAmount': typeof SelectableTokenAmount;
  }
}
