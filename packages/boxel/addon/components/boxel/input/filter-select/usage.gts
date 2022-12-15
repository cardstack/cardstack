import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import BoxelInputFilterSelect from './index';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import { fn } from '@ember/helper';

export default class BoxelInputFilterSelectUsage extends Component {
  filterOptions: string[] = ["Last 30 Days", "Last 90 Days", "Last 120 Days"];

  @tracked disabled = false;
  @tracked label: string = "Date";
  @tracked value: string | undefined;

  cssClassName = 'boxel-input-filter-select';


  @action onChooseFilter(selected: string) {
    this.value = selected;
  }

  <template>
    <FreestyleUsage @name="Input::FilterSelect">
      <:example>
        <BoxelInputFilterSelect
          @disabled={{this.disabled}}
          @value={{this.value}}
          @label={{this.label}}
          @options={{this.filterOptions}}
          @onChooseFilter={{this.onChooseFilter}}
        />
      </:example>
      <:api as |Args|>
        <Args.Array
          @name="options"
          @description="An array of items, to be listed on dropdown"         
          @required={{true}}
          @items={{this.filterOptions}}
          @onChange={{fn (mut this.filterOptions)}}
        />
        <Args.String
          @name="label"
          @description="Label of the filter"
          @required={{true}}
          @onInput={{fn (mut this.label)}}
          @value={{this.label}}
        />
        <Args.Bool
          @name="disabled"
          @description="Whether the input is disabled"
          @defaultValue={{false}}
          @onInput={{fn (mut this.disabled)}}
          @value={{this.disabled}}
        />
        <Args.Action
          @name="onChooseFilter"
          @description="Action called when an item is chosen from the dropdown"
        />
        <Args.Object
          @name="value"
          @description="The selected value"
          @value={{this.value}}
          @onInput={{fn (mut this.value)}}
        />
      </:api>
    </FreestyleUsage>
    <FreestyleUsage @name="Input::FilterSelect">
      <:example>
        <BoxelInputFilterSelect
          @disabled={{this.disabled}}
          @value={{this.value}}
          @label={{this.label}}
          @options={{this.filterOptions}}
          @onChooseFilter={{this.onChooseFilter}}
        />
      </:example>
    </FreestyleUsage>

  </template>
}
