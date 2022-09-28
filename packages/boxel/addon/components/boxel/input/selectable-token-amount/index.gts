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
    <div class="boxel-input-selectable-token-amount" ...attributes>
      <BoxelInput
        class="boxel-input-selectable-token-amount__input"
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
        class="boxel-input-selectable-token-amount__select"
        @options={{@tokens}}
        @selected={{@token}}
        @disabled={{@disabled}}
        @onChange={{@onChooseToken}}
        @dropdownClass="boxel-input-selectable-token-amount__dropdown"
        @verticalPosition="below" as |item itemCssClass|
      >
        <div class="{{itemCssClass}} boxel-input-selectable-token-amount__dropdown-item">
          {{svgJar
            item.icon
            class="boxel-input-selectable-token-amount__icon"
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
