import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelField from './index';
import BoxelInput from '../input';
import BoxelInputValidationState from '../input/validation-state';

import { tracked } from '@glimmer/tracking';
import cssVar from '@cardstack/boxel/helpers/css-var';

//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { fn, array } from '@ember/helper';

export default class FieldUsage extends Component {
  @tracked label = 'Full Name of the Issuer';
  @tracked value = 'Gary Walker';
  @tracked id = 'sample-field';
  @tracked vertical = false;
  @tracked centeredDisplay = false;
  @tracked horizontalLabelSize = 'default';
  @tracked icon = 'profile';
  @tracked tag?: keyof HTMLElementTagNameMap;

  @tracked vertical2 = false;
  @tracked horizontalLabelSize2 = 'default';
  @tracked icon2 = '';

  @tracked labelSize = 'minmax(4rem, 25%)';

  <template>
    <FreestyleUsage @name="Field">
      <:example>
        <BoxelField
          @tag={{this.tag}}
          @label={{this.label}}
          @fieldId={{this.id}}
          @vertical={{this.vertical}}
          @horizontalLabelSize={{this.horizontalLabelSize}}
          @centeredDisplay={{this.centeredDisplay}}
          @icon={{this.icon}}
          style={{cssVar
            boxel-field-label-size=this.labelSize
          }}
        >
          {{this.value}}
        </BoxelField>
      </:example>

      <:api as |Args|>
        <Args.String
          @name="tag"
          @description="html tag to use for the field (ie. use 'label' tag if this is an input/textarea field)"
          @defaultValue="div"
          @value={{this.tag}}
          @onInput={{fn (mut this.tag)}}
        />
        <Args.String
          @name="fieldId"
          @description="field id"
          @value={{this.id}}
          @onInput={{fn (mut this.id)}}
        />
        <Args.String
          @name="label"
          @description="field label"
          @value={{this.label}}
          @onInput={{fn (mut this.label)}}
        />
        <Args.String
          @name="icon"
          @description="icon name"
          @value={{this.icon}}
          @onInput={{fn (mut this.icon)}}
        />
        <Args.Bool
          @name="vertical"
          @description="Whether the field should be displayed vertically"
          @defaultValue="false"
          @onInput={{fn (mut this.vertical)}}
          @value={{this.vertical}}
        />
        <Args.String
          @name="horizontalLabelSize"
          @description="Width of the label column (only applies to horizontal layout)"
          @options={{array "small" "default"}}
          @defaultValue="minmax(4rem, 25%)"
          @onInput={{fn (mut this.horizontalLabelSize)}}
          @value={{this.horizontalLabelSize}}
        />
        <Args.Bool
          @name="centeredDisplay"
          @description="Whether the field content should have a special centered display"
          @defaultValue="false"
          @onInput={{fn (mut this.centeredDisplay)}}
          @value={{this.centeredDisplay}}
        />
        {{!-- template-lint-disable no-unbound --}}
        <Args.String
          @name="--boxel-field-label-size"
          @description="grid-template-columns CSS style"
          @defaultValue={{unbound this.labelSize}}
          @value={{this.labelSize}}
          @onInput={{fn (mut this.labelSize)}}
        />
        <Args.Yield
          @description="Yield value or form field"
        />
      </:api>
    </FreestyleUsage>

    <FreestyleUsage @name="Usage with Boxel::Input">
      <:example>
        <BoxelField
          @tag="label"
          @label="Name"
        >
          <BoxelInput @id="usage-boxel-input" @value="" />
        </BoxelField>
      </:example>
    </FreestyleUsage>

    <FreestyleUsage @name="Usage with Boxel::Input::ValidationState (invalid state)">
      <:example>
        <BoxelField
          @tag="label"
          @label="Name"
          @vertical={{this.vertical2}}
          @horizontalLabelSize={{this.horizontalLabelSize2}}
          @icon={{this.icon2}}
        >
          <BoxelInputValidationState
            @id=""
            @state="invalid"
            @value=""
            @errorMessage="This is a required field"
            @helperText="Please enter a value"
          />
        </BoxelField>
      </:example>
      <:api as |Args|>
        <Args.String
          @name="icon"
          @description="icon name"
          @value={{this.icon2}}
          @onInput={{fn (mut this.icon2)}}
        />
        <Args.Bool
          @name="vertical"
          @description="Whether the field should be displayed vertically"
          @defaultValue="false"
          @onInput={{fn (mut this.vertical2)}}
          @value={{this.vertical2}}
        />
        <Args.String
          @name="horizontalLabelSize"
          @description="Width of the label column (only applies to horizontal layout)"
          @options={{array "small" "default"}}
          @defaultValue="minmax(4rem, 25%)"
          @onInput={{fn (mut this.horizontalLabelSize2)}}
          @value={{this.horizontalLabelSize2}}
        />
      </:api>
    </FreestyleUsage>    
  </template>
}
