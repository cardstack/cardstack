import Component from '@glimmer/component';
import BoxelSelect from '../../select';
import ErrorMessage from '../error-message';
import SelectableTokenItem from '../selectable-token-item';
import { SelectableToken } from '../selectable-token';
import { action } from '@ember/object';
import { guidFor } from '@ember/object/internals';
import and from 'ember-truth-helpers/helpers/and';
import cn from '@cardstack/boxel/helpers/cn';
import { concat } from '@ember/helper';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    disabled?: boolean;
    placeholder?: string;
    errorMessage?: string;
    invalid?: boolean;
    tokens: SelectableToken[];
    value?: SelectableToken;
    onChooseToken: (token: SelectableToken) => void;
    searchEnabled?: boolean;
    onBlur?: (ev: FocusEvent) => void;
  };
}

export default class TokenSelect extends Component<Signature> {
  helperId = guidFor(this);
  get placeholder() {
    return this.args.placeholder || 'Choose a token';
  }
  @action onBlur(_select: any, ev: FocusEvent): void {
    this.args.onBlur?.(ev);
  }
  <template>
    {{#let (and @invalid @errorMessage) as |shouldShowErrorMessage|}}
      <BoxelSelect
        @placeholder={{this.placeholder}}
        @options={{@tokens}}
        @selected={{@value}}
        @searchEnabled={{@searchEnabled}}
        @searchField="symbol"
        @disabled={{@disabled}}
        @onChange={{@onChooseToken}}
        @onBlur={{this.onBlur}}
        @verticalPosition="below"
        aria-invalid={{if @invalid "true"}}
        aria-errormessage={{if shouldShowErrorMessage (concat "error-message-" this.helperId) false}}
        class={{cn
          "boxel-input-token-select"
          boxel-input-token-select--disabled=@disabled
          boxel-input-token-select--invalid=@invalid
        }}
        ...attributes
      as |item itemCssClass|>
        <SelectableTokenItem
          @item={{item}}
          class={{cn itemCssClass "boxel-input-token-select__dropdown-item"}}
        /> 
      </BoxelSelect>
        {{#if shouldShowErrorMessage}}
          <ErrorMessage
            id={{concat "error-message-" this.helperId}}
            @message={{@errorMessage}}
          />
        {{/if}}
      {{/let}}
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Input::TokenSelect': typeof TokenSelect;
  }
}
