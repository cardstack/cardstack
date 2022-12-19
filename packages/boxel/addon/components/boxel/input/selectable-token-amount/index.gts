import Component from '@glimmer/component';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import BoxelInputGroup from '../../input-group';
import SelectableTokenItem from '../selectable-token-item';
import { fn } from '@ember/helper';
import { action } from '@ember/object';
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
    token: SelectableToken | undefined;
    tokens: SelectableToken[];
    onInput: (amount: string) => void;
    onChooseToken: (token: SelectableToken) => void;
    onBlurToken?: (event: FocusEvent) => void
  };
  Blocks: {
    'default': [],
  }
}

export default class SelectableTokenAmount extends Component<Signature> {
  get id() {
    return this.args.id || guidFor(this);
  }
  @action onBlurToken(_select: any, ev: FocusEvent): void {
    return this.args.onBlurToken?.(ev);
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
          @placeholder="Choose token"
          @options={{@tokens}}
          @selected={{@token}}
          @searchField="symbol"
          @disabled={{@disabled}}
          @onChange={{@onChooseToken}}
          @onBlur={{this.onBlurToken}}
          @dropdownClass="boxel-input-selectable-token-amount__dropdown"
          @verticalPosition="below" as |item itemCssClass|
        >
          <SelectableTokenItem
            @item={{item}}
            class={{cn itemCssClass "boxel-input-selectable-token-amount__dropdown-item"}}
          /> 
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
