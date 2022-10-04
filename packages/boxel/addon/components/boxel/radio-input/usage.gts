import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelRadioInput from './index';
import cssVar from '@cardstack/boxel/helpers/css-var';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { fn, array, hash } from '@ember/helper';

import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class RadioInputUsage extends Component {
  @tracked items = [
    {
      id: 'eggs',
      text: 'Eggs',
    },
    {
      id: 'tofu',
      text: 'Tofu',
    },
    {
      id: 'strawberry',
      text: 'Strawberry',
    },
  ];
  @tracked groupDescription =
    'Select one of these options for breakfast sandwiches';
  @tracked checkedId = this.items[0].id;
  @tracked disabled = false;
  @tracked hideRadio = false;
  @tracked hideBorder = false;
  @tracked spacing = '';
  @tracked orientation = 'horizontal';

  @tracked optionPadding = 'var(--boxel-sp)';
  @tracked optionGap = 'var(--boxel-sp-sm)';

  @action onChange(id: string): void {
    this.checkedId = id;
  }
  <template>
    <FreestyleUsage @name="RadioInput" @description="A radio button component with some accessibility considerations built in">
      <:example>
        <BoxelRadioInput
          @groupDescription={{this.groupDescription}}
          @items={{this.items}}
          @name="example-radio-usage"
          @checkedId={{this.checkedId}}
          @disabled={{this.disabled}}
          @hideBorder={{this.hideBorder}}
          @hideRadio={{this.hideRadio}}
          @orientation={{this.orientation}}
          @spacing={{this.spacing}}
          style={{cssVar
            boxel-radio-option-padding=this.optionPadding
            boxel-radio-option-gap=this.optionGap
          }}
        as |item|>
          <item.component @onChange={{fn this.onChange item.data.id}}>
            {{item.data.text}}
          </item.component>
        </BoxelRadioInput>
      </:example>

      <:api as |Args|>
        <Args.String
          @name="groupDescription"
          @description="Description for this group of radio buttons"
          @value={{this.groupDescription}}
          @onInput={{fn (mut this.groupDescription)}}
          @optional={{true}}
        />
        <Args.Object
          @name="items"
          @description="Items which will be represented by radio buttons. Each should have a unique 'id' attribute"
          @value={{this.items}}
          @onInput={{fn (mut this.items)}}
        />
        <Args.String
          @name="checkedId"
          @description="The id of the currently checked/selected item"
          @value={{this.checkedId}}
          @onInput={{fn (mut this.checkedId)}}
          @optional={{true}}
        />
        <Args.Bool
          @name="disabled"
          @description="Whether selection is disabled"
          @defaultValue="false"
          @value={{this.disabled}}
          @onInput={{fn (mut this.disabled)}}
          @optional={{true}}
        />
        <Args.Bool
          @name="hideRadio"
          @description="Visually hides the radio input circle"
          @defaultValue="false"
          @value={{this.hideRadio}}
          @onInput={{fn (mut this.hideRadio)}}
        />
        <Args.Bool
          @name="hideBorder"
          @description="Visually hides the item border"
          @defaultValue="false"
          @value={{this.hideBorder}}
          @onInput={{fn (mut this.hideBorder)}}
        />
        <Args.String
          @name="spacing"
          @description="Adjusts spacing level"
          @defaultValue=""
          @options={{array "default" "compact"}}
          @onInput={{fn (mut this.spacing)}}
          @value={{this.spacing}}
        />
        <Args.String
          @name="orientation"
          @description="Orientation of the radio buttons"
          @defaultValue="horizontal"
          @options={{array "horizontal" "vertical" "default"}}
          @onInput={{fn (mut this.orientation)}}
          @value={{this.orientation}}
        />
        {{!-- template-lint-disable no-unbound --}}
        <Args.String
          @name="--boxel-radio-option-padding"
          @description="padding for each option"
          @defaultValue={{unbound this.optionPadding}}
          @value={{this.optionPadding}}
          @onInput={{fn (mut this.optionPadding)}}
        />
        <Args.String
          @name="--boxel-radio-option-gap"
          @description="gap between circle and label"
          @defaultValue={{unbound this.optionGap}}
          @value={{this.optionGap}}
          @onInput={{fn (mut this.optionGap)}}
        />
        <Args.Yield
          @description="Yields an object with the default component to use (RadioInput::Item), the data for the item passed in, and whether that item is selected"
        />
      </:api>
    </FreestyleUsage>  
  </template>
}
