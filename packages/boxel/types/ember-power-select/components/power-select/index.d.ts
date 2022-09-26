/* eslint-disable ember/no-empty-glimmer-component-classes */
import Component from '@glimmer/component';
import { PowerSelectArgs } from 'ember-power-select/addon/components/power-select';

import {
  BasicDropdownArgs,
  BasicDropdownTriggerArgs,
} from 'ember-basic-dropdown/components/basic-dropdown';

type SharedDropdownType = Pick<BasicDropdownArgs, 'renderInPlace'> &
  Partial<Pick<BasicDropdownTriggerArgs, 'eventType'>>;

export interface PatchedPowerSelectArgs
  extends PowerSelectArgs,
    SharedDropdownType {
  verticalPosition?: 'auto' | 'below' | 'above';
  dropdownClass?: string;
  placeholder?: string;
  selectedItemComponent?: Component | string;
}

export default class PowerSelect extends Component<{
  Element: HTMLDivElement;
  Args: PatchedPowerSelectArgs;
  // TODO: figure out property types for default block
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Blocks: { default: [any, any] };
}> {}
