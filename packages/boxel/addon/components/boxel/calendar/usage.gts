import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelCalendar, { Day } from './index';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import { action } from '@ember/object';

export default class BoxelCalendarUsage extends Component {
  cssClassName = 'boxel-calendar';

  @tracked selected: Day = new Date(2022,7,4);
  @action onSelect(val: Day) {
    this.selected = val;
  }
  @tracked center: Day = new Date(2022,7,4);
  @action onCenterChange(val: Day) {
    this.center = val;
  }
  minDate: Day = new Date(2022,7,4);
  maxDate: Day = new Date(2024,7,4);

  <template>
    <FreestyleUsage @name="Calendar">
      <:description>
        A thin wrapper around Ember Power Calendar.
      </:description>
      <:example>
        <BoxelCalendar
          @selected={{this.selected}}
          @onSelect={{this.onSelect}}
          @center={{this.center}}
          @onCenterChange={{this.onCenterChange}}
          @minDate={{this.minDate}}
          @maxDate={{this.maxDate}}
        />
      </:example>
      <:api as |Args|>
        <Args.Object
          @name="selected"
          @description="The current selected day"
          @value={{this.selected}}
          @onInput={{fn (mut this.selected)}}
        />
        <Args.Action
          @name="onSelect"
          @description="Called when a user changes the selected date"
        />
        <Args.Object
          @name="center"
          @description="A day in the currently showing month"
          @value={{this.selected}}
          @onInput={{fn (mut this.selected)}}
        />
        <Args.Action
          @name="onCenterChange"
          @description="Called when a user changes the month shown"
        />
        <Args.Object
          @name="minDate"
          @description="Dates before this date will be disabled"
          @value={{this.minDate}}
        />
        <Args.Object
          @name="maxDate"
          @description="Dates after this date will be disabled"
          @value={{this.maxDate}}
        />
      </:api>
    </FreestyleUsage>
  </template>
}
