import Component from '@glimmer/component';
import BoxelInput from '../index';
import { type EmptyObject } from '@ember/component/helper';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

export type InputValidationState = 'valid' | 'invalid' | 'loading' | 'initial';

interface ValidationStateInputArgs {
  state: InputValidationState;
  disabled: boolean;
  errorMessage?: string;
  helperText?: string;
  id: string;
  value: string;
  onInput: (val: string) => void;
  onBlur: (ev: Event) => void;
}

interface Signature {
 Element: HTMLDivElement;
 Args: ValidationStateInputArgs;
 Blocks: EmptyObject;
};

export default class BoxelInputValidationState extends Component<Signature> {
  get icon(): string {
    if (this.args.disabled) {
      return '';
    }
    switch (this.args.state) {
      case 'valid':
        return 'success-bordered';
      case 'invalid':
        return 'failure-bordered';
      case 'loading':
        return 'loading-indicator';
      case 'initial':
        return '';
      default:
        return '';
    }
  }

  get isInvalid(): boolean {
    return this.args.state === 'invalid';
  }

  <template>
    <div class="boxel-validation-state-input-group" ...attributes>
      <BoxelInput
        class="boxel-validation-state-input-group__input"
        @id={{@id}}
        @value={{@value}}
        @required={{unless @disabled true}}
        @onInput={{@onInput}}
        @onBlur={{@onBlur}}
        @invalid={{unless @disabled this.isInvalid}}
        @disabled={{@disabled}}
        @errorMessage={{@errorMessage}}
        @helperText={{@helperText}}
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        data-test-boxel-input-validation-state={{if @disabled true @state}}
      />
      {{#if this.icon}}
        {{svgJar this.icon class="boxel-validation-state-input-group__icon" role="presentation"}}
      {{/if}}
    </div>
  </template>
}
