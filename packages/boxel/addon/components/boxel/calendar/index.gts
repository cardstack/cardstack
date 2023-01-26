import Component from '@glimmer/component';
import PowerCalendar from 'ember-power-calendar/components/power-calendar';
import { action } from '@ember/object';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    selected?: Day;
    onSelect?: Function;
    center?: Day;
    onCenterChange?: Function;
    minDate?: Day;
    maxDate?: Day;
  };
}

export interface Day {
  getFullYear: () => number;
  getMonth: () => number;
  getDate: () => number;
  toLocaleDateString: (arg1: any, options: any) => string;
}

export default class BoxelCalendar extends Component<Signature> {
  @action handleSelect(val: { date: Date }) {
    this.args.onSelect?.(val.date);
  }
  @action handleCenterChange(val: { date: Date }) {
    this.args.onCenterChange?.(val.date);
  }

  <template>
    <PowerCalendar
      @selected={{@selected}}
      @onSelect={{this.handleSelect}}
      @center={{@center}}
      @onCenterChange={{this.handleCenterChange}}
      class="boxel-calendar"
      data-test-boxel-calendar
      ...attributes
      as |calendar|
    >
      <calendar.Nav />
      <calendar.Days @weekdayFormat="min" @minDate={{@minDate}} @maxDate={{@maxDate}} />
    </PowerCalendar>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Calendar': typeof BoxelCalendar;
  }
}
