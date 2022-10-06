import Component from '@glimmer/component';
import { AccessoriesBlockArg, TextAccessory, SelectAccessory, ButtonAccessory, IconButtonAccessory } from './accessories';
import { ControlsBlockArg, TextareaControl, InputControl } from './controls';

import and from 'ember-truth-helpers/helpers/and';
import cn from '@cardstack/boxel/helpers/cn';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { concat, hash } from '@ember/helper';
import { guidFor } from '@ember/object/internals';

import '@cardstack/boxel/styles/global.css';
import './index.css';

export interface InputGroupBlockArg {
  elementId: string;
}

export interface Signature {
  Element: HTMLDivElement;
  Args: {
    errorMessage?: string;
    helperText?: string;
    id?: string;
    disabled?: boolean;
    required?: boolean;
    readonly?: boolean;
    invalid?: boolean;
    placeholder?: string;
    value?: string;
    onInput?: (val: string) => void;
    onBlur?: (ev: Event) => void;
  };
  Blocks: {
    before: [AccessoriesBlockArg, InputGroupBlockArg];
    default: [ControlsBlockArg, AccessoriesBlockArg, InputGroupBlockArg];
    after: [AccessoriesBlockArg, InputGroupBlockArg];
  };
}

export default class InputGroup extends Component<Signature> {
  get elementId() {
    return this.args.id || guidFor(this);
  }
  get inputGroupBlockArg() {
    return {
      elementId: this.elementId
    };
  }

  <template>
    {{#let
        (and @invalid @errorMessage)
        (hash
          Text=(component TextAccessory)
          Button=(component ButtonAccessory kind="secondary-light")
          IconButton=(component IconButtonAccessory)
          Select=(component SelectAccessory)
        )
        (hash
          Input=(component InputControl)
          Textarea=(component TextareaControl)
        )
      as |shouldShowErrorMessage Accessories Controls|}}
      <div
        class={{cn
          "boxel-input-group"
          boxel-input-group--invalid=@invalid
          boxel-input-group--disabled=@disabled
        }}
        data-test-boxel-input-group
        ...attributes
      >
        {{yield Accessories this.inputGroupBlockArg to="before"}}
        {{#if (has-block "default")}}
          {{yield Controls Accessories this.inputGroupBlockArg }}
        {{else}}
          <Controls.Input
            id={{this.elementId}}
            @placeholder={{@placeholder}}
            @disabled={{@disabled}}
            @readonly={{@readonly}}
            @required={{@required}}
            @value={{@value}}
            @onInput={{@onInput}}
            @onBlur={{@onBlur}}
            aria-describedby={{if @helperText (concat "helper-text-" this.elementId) false}}
            aria-invalid={{if @invalid "true"}}
            aria-errormessage={{if shouldShowErrorMessage (concat "error-message-" this.elementId) false}}
          />
        {{/if}}
        {{yield Accessories this.inputGroupBlockArg to="after"}}
      </div>
      {{#if shouldShowErrorMessage}}
        <div id={{concat "error-message-" this.elementId}} class="boxel-input-group__error-message" aria-live="polite" data-test-boxel-input-group-error-message>{{@errorMessage}}</div>
      {{/if}}
      {{#if @helperText}}
        <div id={{concat "helper-text-" this.elementId}} class="boxel-input-group__helper-text" data-test-boxel-input-group-helper-text>{{@helperText}}</div>
      {{/if}}
    {{/let}}
  </template>
};
