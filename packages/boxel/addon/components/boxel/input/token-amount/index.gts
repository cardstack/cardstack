import type { TemplateOnlyComponent } from '@ember/component/template-only';
import BoxelInput from '../index';
import { type EmptyObject } from '@ember/component/helper';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import { fn } from '@ember/helper';

export interface Signature {
  Element: HTMLDivElement;
  Args: {
    icon: string;
    symbol: string;
    errorMessage?: string;
    helperText?: string;
    id: string;
    disabled?: boolean;
    invalid?: boolean;
    value: string;
    onInput: (val: string) => void;
  };
  Blocks: EmptyObject;
}

const InputTokenAmount: TemplateOnlyComponent<Signature> = <template>
  <div class="boxel-token-amount-input-group" ...attributes>
    {{svgJar @icon class="boxel-token-amount-input-group__icon" role="presentation"}}
    <BoxelInput
      class="boxel-token-amount-input-group__input"
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
      data-test-boxel-input-token-amount
    />
    <div class="boxel-token-amount-input-group__symbol">
      {{@symbol}}
    </div>
  </div>
</template>
export default InputTokenAmount;