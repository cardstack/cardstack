import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelSelectionControlGroup from './index';
import BoxelMenu from '../menu';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { array, fn } from '@ember/helper';
import menuItem from '@cardstack/boxel/helpers/menu-item'

export default class extends Component {
  @tracked selectedItemCount = 0;
  @tracked isSelected = false;
  @tracked mode = 'view';

  @action setSelectedItemCount(val: number | string): void {
    val = Number(val);
    this.selectedItemCount = val;
    this.isSelected = val === 50;
  }

  @action setIsSelected(val: boolean): void {
    this.isSelected = val;
    this.selectedItemCount = val ? 50 : 0;
  }

  @action toggleSelectAll(): void {
    if (this.isSelected) {
      this.isSelected = false;
      this.selectedItemCount = 0;
    } else {
      this.isSelected = true;
      this.selectedItemCount = 50;
    }
  }

  @action logMenuItem() {
    console.log('menu item clicked');
  }

  <template>
    <FreestyleUsage @name="SelectionControlGroup">
      <:example>
        <BoxelSelectionControlGroup
          @toggleSelectAll={{this.toggleSelectAll}}
          @mode={{this.mode}}
          @selectedItemCount={{this.selectedItemCount}}
          @isSelected={{this.isSelected}}
          @menuComponent={{component BoxelMenu items=(array
            (menuItem "Delete" this.logMenuItem)
            (menuItem "Duplicate" this.logMenuItem)
          )}}
        />
      </:example>
      <:api as |Args|>
        <Args.Action
          @name="toggleSelectAll"
          @description="Invoked when user indicates she wants to toggle the select-all state"
          @value={{this.toggleSelectAll}}
        />
        <Args.String
          @name="mode"
          @description="which card mode are we in"
          @value={{this.mode}}
          @onInput={{fn (mut this.mode)}}
        />
        <Args.Number
          @name="selectedItemCount"
          @description="(integer) — the number of items selected"
          @value={{this.selectedItemCount}}
          @defaultValue={{0}}
          @min={{0}}
          @max={{50}}
          @onInput={{this.setSelectedItemCount}}
        />
        <Args.Bool
          @name="isSelected"
          @value={{this.isSelected}}
          @description="fully selected state"
          @defaultValue={{false}}
          @onInput={{this.setIsSelected}}
        />
        <Args.Object
          @name="menuComponent"
          @description="(Component) component to show when more actions menu icon is clicked"
        />
      </:api>
    </FreestyleUsage>

  </template>
}
