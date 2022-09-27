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
          @dropdownClass="boxel-select-usage-dropdown"
          as |item itemCssClass|
        >
         <div class={{itemCssClass}}>{{item}}</div>
        </BoxelSelect>
      </:example>
      <:api as |Args|>
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
      </:api>
    </FreestyleUsage>
  </template>
}