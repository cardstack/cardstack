import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelInputDate, { Day } from './index';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import { action } from '@ember/object';

export default class BoxelInputDateUsage extends Component {
  cssClassName = 'boxel-input-date';

  @tracked value = new Date(2022, 7, 4) as Day;
  @action onChange(val: Day) {
    this.value = val;
  }
  minDate = new Date(2022, 7, 4) as Day;
  maxDate = new Date(2024, 7, 4) as Day;
  
  <template>
    <FreestyleUsage @name="InputDate">
      <:description>
        A succint version of a date picker.
      </:description>
      <:example>
        <BoxelInputDate
          @value={{this.value}}
          @onChange={{this.onChange}}
          @minDate={{this.minDate}}
          @maxDate={{this.maxDate}}
        />
      </:example>
      <:api as |Args|>
        <Args.Object
          @name="value"
          @description="An object conforming to the Day interface exported from the Boxel::Date component"
          @value={{this.value}}
          @onInput={{fn (mut this.value)}}
        />
        <Args.Object
          @name="minDate"
          @description="An object conforming to the Day interface exported from the Boxel::Date component"
          @value={{this.minDate}}
        />
        <Args.Object
          @name="maxDate"
          @description="An object conforming to the Day interface exported from the Boxel::Date component"
          @value={{this.maxDate}}
        />
        <Args.Action
          @name="onChange"
          @description="Called when a new date is selected by the user"
        />
      </:api>
    </FreestyleUsage>
  </template>
}
