/* eslint-disable ember/no-empty-glimmer-component-classes */
import Component from '@glimmer/component';
import { PowerSelectArgs } from 'ember-power-select/addon/components/power-select';

interface PatchedPowerSelectArgs extends PowerSelectArgs {
  dropdownClass?: string;
  eventType?: string;
  placeholder?: string;
  renderInPlace?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedItemComponent?: any;
  verticalPosition?: string;
}

export default class PowerSelect extends Component<{
  Element: HTMLDivElement;
  Args: PatchedPowerSelectArgs;
  // TODO: figure out property types for default block
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Blocks: { default: [any, any] };
}> {}
