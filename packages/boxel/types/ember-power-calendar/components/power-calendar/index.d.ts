/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable ember/no-empty-glimmer-component-classes */
import Component from '@glimmer/component';
import { ComponentLike } from '@glint/template';

interface DaysComponentSignature {
  Args: {
    weekdayFormat: string;
  };
}

interface CalendarYield {
  Nav: ComponentLike;
  Days: ComponentLike<DaysComponentSignature>;
}

interface Signature {
  Element: HTMLDivElement;
  Args: {
    selected?: any;
    onSelect?: any;
    center?: any;
    onCenterChange?: any;
  };
  Blocks: {
    default: [CalendarYield];
  };
}
export default class PowerCalendar extends Component<Signature> {}
