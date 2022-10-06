import Component from '@glimmer/component';
import { type EmptyObject } from '@ember/component/helper';
import cn from '@cardstack/boxel/helpers/cn';
import and from 'ember-truth-helpers/helpers/and';
import not from 'ember-truth-helpers/helpers/not';
import { concat } from '@ember/helper';
import element from 'ember-element-helper/helpers/element';
import { on } from '@ember/modifier';
import optional from 'ember-composable-helpers/helpers/optional';
import pick from 'ember-composable-helpers/helpers/pick';
import { guidFor } from '@ember/object/internals';

import '@cardstack/boxel/styles/global.css';
import './index.css';
import './token-amount/index.css';
import './validation-state/index.css';

export interface Signature {
  Element: HTMLInputElement | HTMLTextAreaElement;
  Args: {
    errorMessage?: string;
    helperText?: string;
    id: string;
    disabled?: boolean;
    invalid?: boolean;
    multiline?: boolean;
    value: string;
    onInput?: (val: string) => void;
    onBlur?: (ev: Event) => void;
    required?: boolean;
    optional?: boolean;
  };
  Blocks: EmptyObject;
}

export default class BoxelInput extends Component<Signature> {
  helperId = guidFor(this);

  <template>
    {{#if (and (not @required) @optional)}}
      <div class="boxel-input__optional">Optional</div>
    {{/if}}
    {{#let (and @invalid @errorMessage) as |shouldShowErrorMessage|}}
      {{#let (element (if @multiline "textarea" "input")) as |InputTag|}}
        {{!-- @glint-expect-error stumped on how to type this --}}
        <InputTag
          class={{cn "boxel-input" boxel-input--invalid=@invalid}}
          id={{@id}}
          value={{@value}}
          required={{@required}}
          disabled={{@disabled}}
          aria-describedby={{if @helperText (concat "helper-text-" this.helperId) false}}
          aria-invalid={{if @invalid "true"}}
          aria-errormessage={{if shouldShowErrorMessage (concat "error-message-" this.helperId) false}}
          data-test-boxel-input
          data-test-boxel-input-id={{@id}}
          {{on "input" (pick "target.value" (optional @onInput))}}
          {{on "blur" (optional @onBlur)}}
          ...attributes
        />
        {{#if shouldShowErrorMessage}}
          <div id={{concat "error-message-" this.helperId}} class="boxel-input__error-message" aria-live="polite" data-test-boxel-input-error-message>{{@errorMessage}}</div>
        {{/if}}
        {{#if @helperText}}
          <div id={{concat "helper-text-" this.helperId}} class="boxel-input__helper-text" data-test-boxel-input-helper-text>{{@helperText}}</div>
        {{/if}}
      {{/let}}
    {{/let}}
  </template>
}
