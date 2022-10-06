import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import { action } from '@ember/object';
//@ts-expect-error glint does not think array is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { fn, array } from '@ember/helper';
import { A } from '@ember/array';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';

import BoxelSelect from './index';

export default class BoxelSelectUsage extends Component {
  @tracked items = A([...new Array(10)].map((_, idx) => `Item - ${idx}`));

  @tracked selectedItem: string | null = null;
  @tracked placeholder: string = 'Select Item';
  @tracked verticalPosition = 'auto' as const;

  @tracked renderInPlace = false;
  @tracked disabled = false;

  @tracked currentColorCssValue: string = 'var(--boxel-light-100)';
  @tracked selectedColorCssValue: string = 'var(--boxel-highlight)';

  @action onSelectItem(item: string| null): void {
    this.selectedItem = item;
  }

  <template>
    <style>
      .boxel-select-usage-dropdown {
        --boxel-select-current-color: {{this.currentColorCssValue}};
        --boxel-select-selected-color: {{this.selectedColorCssValue}};
      }
    </style>
    <FreestyleUsage @name="Select">
      <:example>
        <BoxelSelect
          @placeholder={{this.placeholder}}
          @selected={{this.selectedItem}}
          @onChange={{this.onSelectItem}}
          @options={{this.items}}
          @verticalPosition={{this.verticalPosition}}
          @renderInPlace={{this.renderInPlace}}
          @disabled={{this.disabled}}
          @dropdownClass="boxel-select-usage-dropdown"
          as |item itemCssClass|
        >
         <div class={{itemCssClass}}>{{item}}</div>
        </BoxelSelect>
      </:example>
      <:api as |Args|>
        <Args.Array
          @name="options"
          @description="An array of items, to be listed on dropdown"         
          @required={{true}}
          @items={{this.items}}
          @onChange={{fn (mut this.items)}}
        />
        <Args.Action
          @name="onChange"
          @description="Invoke this action to close handle selected item"
          @required={{true}}
        />
        <Args.Object
          @name="selected"
          @description="Selected item, its type is dependent on items"
          @required={{true}}
        />
        <Args.Yield
          @name="item"
          @description="Item to be presented on dropdown"
        />
        <Args.Yield
          @name="itemCssClass"
          @description="Class to be set on item wrapper to add default styles"
        />
        <Args.String
          @name="placeholder"
          @description="Placeholder for trigger component"
          @value={{this.placeholder}}
          @onInput={{fn (mut this.placeholder)}}
        />
        <Args.String
          @name="verticalPosition"
          @defaults='auto'
          @options={{array "auto" "above" "below"}}
          @onInput={{fn (mut this.verticalPosition)}}
          @description="The vertical positioning strategy of the content"
        />
        <Args.Bool
          @name="renderInPlace"
          @defaults={{false}}
          @onInput={{fn (mut this.renderInPlace)}}
          @description="When passed true, the content will render next to the trigger instead of being placed in the root of the body"
        />
        <Args.Bool
          @name="disabled"
          @defaults={{false}}
          @onInput={{fn (mut this.disabled)}}
          @description="When truthy the component cannot be interacted"
        />  
        <Args.String
          @name="--boxel-select-current-color"
          @defaultValue={{unbound this.currentColorCssValue}}
          @value={{this.currentColorCssValue}}
          @onInput={{fn (mut this.currentColorCssValue)}}
        />
        <Args.String
          @name="--boxel-select-selected-color"
          @defaultValue={{unbound this.selectedColorCssValue}}
          @value={{this.selectedColorCssValue}}
          @onInput={{fn (mut this.selectedColorCssValue)}}
        />      
        <Args.String
          @name="dropdownClass"
          @description="Class to be applied to the dropdown only"
        />
        <Args.Object
          @name="triggerComponent"
          @description="The component to rended as content instead of the default trigger component"
        />
        <Args.Object
          @name="selectedItemComponent"
          @description="The component to render to customize just the selected item of the trigger"
        />
        <Args.String
          @name="--boxel-select-below-transitioning-in-animation"
          @description='Animation for dropdown appearing below. On close animation is reversed'
        />
        <Args.String
          @name="--boxel-select-above-transitioning-in-animation"
          @description='Animation for dropdown appearing above. On close animation is reversed'
        /> 
      </:api>
    </FreestyleUsage>
  </template>
}
