import Component from '@glimmer/component';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import BoxelSelect from '../../select';
import SelectableTokenItem from '../selectable-token-item';
import cn from '@cardstack/boxel/helpers/cn';
import { SelectableToken } from '../selectable-token';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    disabled?: boolean;
    placeholder?: string;
    tokens: SelectableToken[];
    value?: SelectableToken;
    onChooseToken: (token: SelectableToken) => void;
  };
}

export default class TokenSelect extends Component<Signature> { 
  get placeholder() {
    return this.args.placeholder || 'Choose a token';
  }
  <template>
    <BoxelSelect
      @placeholder={{this.placeholder}}
      @options={{@tokens}}
      @selected={{@value}}
      @disabled={{@disabled}}
      @onChange={{@onChooseToken}}
      @verticalPosition="below"
      class={{cn "boxel-input-token-select" boxel-input-token-select--disabled=@disabled}}
      ...attributes
     as |item itemCssClass|>
      <SelectableTokenItem
        @item={{item}}
        class={{cn itemCssClass "boxel-input-token-select__dropdown-item"}}
      /> 
    </BoxelSelect>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Input::TokenSelect': typeof TokenSelect;
  }
}
