import Component from '@glimmer/component';
import { Input } from '@ember/component';
import ErrorMessage from '../input/error-message';

import { concat, hash } from '@ember/helper';
import { action } from '@ember/object';
import { guidFor } from '@ember/object/internals';
import { WithBoundArgs } from '@glint/template';
import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { on } from '@ember/modifier';
import and from 'ember-truth-helpers/helpers/and';
import eq from 'ember-truth-helpers/helpers/eq';
import cn from '@cardstack/boxel/helpers/cn';
import optional from 'ember-composable-helpers/helpers/optional';

import '@cardstack/boxel/styles/global.css';
import './index.css';

export type ButtonYieldedByToggleButtonGroup = WithBoundArgs<typeof Button, 'disabled'|'chosenValue'|'name'|'onChange'|'onBlur'>;

interface Signature {
  Element: HTMLFieldSetElement;
  Args: {
    disabled?: boolean;
    errorMessage?: string;
    invalid?: boolean;
    groupDescription: string;
    name: string;
    onChange: ((value: string) => void);
    onBlur?: (() => void);
    value?: string;
  };
  Blocks: {
    'default': [{ Button: ButtonYieldedByToggleButtonGroup }],
  }
}

interface ButtonSignature {
  Element: HTMLElement
  Args: {
    chosenValue?: string;
    disabled: boolean;
    name: string;
    onChange: ((event: InputEvent) => void);
    onBlur?: (() => void);
    value: string;
  },
  Blocks: {
    default: [],
  }
}

const Button: TemplateOnlyComponent<ButtonSignature> =
<template>
  {{#let (eq @value @chosenValue) as |checked|}}
    <label
      class={{cn
        "boxel-toggle-button-group-option"
        boxel-toggle-button-group-option--checked=checked
        boxel-toggle-button-group-option--disabled=@disabled
      }}
      data-toggle-group-option={{@value}}
      ...attributes
    >
      <Input
        name={{@name}}
        class={{cn
          "boxel-toggle-button-group-option__input"
          boxel-toggle-button-group-option__input--checked=checked
        }}
        @type="radio"
        @value={{@value}}
        disabled={{@disabled}}
        {{on "change" (optional @onChange)}}
        {{on "blur" (optional @onBlur)}}
      />
      <div>
        {{yield}}
      </div>
    </label>
  {{/let}}
</template>;

export default class ToggleButtonGroupComponent extends Component<Signature> {
  helperId = guidFor(this);

  @action changeValue(e: Event) {
    let value = (e.target as HTMLInputElement).value;
    this.args.onChange?.(value);
  }

  <template>
    {{#let (and @invalid @errorMessage) as |shouldShowErrorMessage|}}
      <fieldset
        class={{cn
          "boxel-toggle-button-group__fieldset"
          boxel-toggle-button-group--invalid=shouldShowErrorMessage
        }}
        disabled={{@disabled}}
        ...attributes
      >
        <legend class="boxel-toggle-button-group__fieldset-legend">
          {{@groupDescription}}
        </legend>
        {{!-- this div is necessary because Chrome has a special case for fieldsets and it breaks grid auto placement --}}
        <div class="boxel-toggle-button-group__fieldset-container">
          {{yield
              (hash
                Button=(component
                  Button
                  kind="primary"
                  disabled=@disabled
                  name=@name
                  onChange=this.changeValue
                  onBlur=@onBlur
                  chosenValue=@value
                )
              )
          }}
        </div>
      </fieldset>
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
    'Boxel::ToggleButtonGroup': typeof ToggleButtonGroupComponent;
  }
}
