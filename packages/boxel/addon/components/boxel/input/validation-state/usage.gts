import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelInputValidationState, { InputValidationState } from './index';

import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { fn, array } from '@ember/helper';

export default class BoxelInputValidationStateUsage extends Component {
  @tracked id = 'validation-input-usage-id';
  @tracked value = '';
  @tracked state: InputValidationState = 'initial';
  @tracked helperText = 'Please enter a value';
  @tracked errorMessage = '';
  @tracked disabled = false;

  @action set(val: string): void {
    this.value = val;
    if (!val) {
      this.state = 'invalid';
    } else {
      this.state = 'valid';
    }
  }

  @action validate(ev: Event): void {
    let target = ev.target as HTMLInputElement;
    if (!target.validity?.valid) {
      this.state = 'invalid';
      if (target.validity?.valueMissing) {
        this.errorMessage = 'This is a required field';
      } else {
        this.errorMessage = target.validationMessage;
      }
      return;
    }
    this.state = 'valid';
    this.errorMessage = '';
  }

  <template>
    <FreestyleUsage @name="Input::ValidationState">
      <:example>
        <label for={{this.id}} class="boxel-sr-only">Label</label>
        <BoxelInputValidationState
          @id={{this.id}}
          @disabled={{this.disabled}}
          @state={{this.state}}
          @value={{this.value}}
          @onInput={{this.set}}
          @onBlur={{this.validate}}
          @errorMessage={{this.errorMessage}}
          @helperText={{this.helperText}}
        />
      </:example>
      <:api as |Args|>
        <Args.String
          @name="id"
          @description="The id of the input"
          @onInput={{fn (mut this.id)}}
          @value={{this.id}}
        />
        <Args.Bool
          @name="disabled"
          @description="Whether the input is disabled"
          @defaultValue={{false}}
          @onInput={{fn (mut this.disabled)}}
          @value={{this.disabled}}
        />
        <Args.String
          @name="state"
          @description="The validation state of the input"
          @options={{array "valid" "invalid" "loading" "initial" "default"}}
          @onInput={{fn (mut this.state)}}
          @value={{this.state}}
        />
        <Args.String
          @name="helperText"
          @description="Helper message to display below the input"
          @value={{this.helperText}}
          @onInput={{fn (mut this.helperText)}}
        />
        <Args.String
          @name="errorMessage"
          @description="Error message to display when the input is invalid"
          @value={{this.errorMessage}}
          @onInput={{fn (mut this.errorMessage)}}
        />
        <Args.Action
          @name="onInput"
          @description="Action to call when the input value changes"
        />
        <Args.Action
          @name="onBlur"
          @description="Action to call when the input loses focus"
        />
        <Args.String
          @name="value"
          @description="The value of the input"
          @value={{this.value}}
          @onInput={{this.set}}
        />
      </:api>
    </FreestyleUsage>    
  </template>
}
