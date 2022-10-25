import Component from '@glimmer/component';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import BoxelInputGroup from '../../input-group';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import { fn } from '@ember/helper';
import { guidFor } from '@ember/object/internals';
import cn from '@cardstack/boxel/helpers/cn';
import { SelectableToken } from '../selectable-token';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    id?: string;
    value: string;
    disabled?: boolean;
    helperText?: string;
    invalid: boolean;
    errorMessage: string;
    onInput: (amount: string) => void;
    onChooseToken: (token: SelectableToken) => void;
    token: SelectableToken;
    tokens: SelectableToken[];
  };
  Blocks: {
    'default': [],
  }
}

export default class SelectableTokenAmount extends Component<Signature> {
  get id() {
    return this.args.id || guidFor(this);
  }
  
  <template>
    <BoxelInputGroup
      @id={{this.id}}
      @placeholder="0.00"
      @value={{@value}}
      @invalid={{unless @disabled @invalid}}
      @errorMessage={{@errorMessage}}
      @helperText={{@helperText}}
      @disabled={{@disabled}}
      @onInput={{@onInput}}
      @onBlur={{fn @onInput @value}}
      @autocomplete="off"
      @inputmode="decimal"
      class="boxel-input-selectable-token-amount"
      ...attributes
    >
      <:after as |Accessories|>
        <Accessories.Select
          class="boxel-input-selectable-token-amount__select"
          @options={{@tokens}}
          @selected={{@token}}
          @disabled={{@disabled}}
          @onChange={{@onChooseToken}}
          @dropdownClass="boxel-input-selectable-token-amount__dropdown"
          @verticalPosition="below" as |item itemCssClass|
        >
          <div class={{cn itemCssClass "boxel-input-selectable-token-amount__dropdown-item"}}>
            {{svgJar
              item.icon
              class="boxel-input-selectable-token-amount__icon"
              role="presentation"
            }}
            {{item.name}}
          </div>
        </Accessories.Select>
      </:after>
    </BoxelInputGroup>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Input::SelectableTokenAmount': typeof SelectableTokenAmount;
  }
}
