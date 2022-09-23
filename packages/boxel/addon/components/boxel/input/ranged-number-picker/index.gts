import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { type EmptyObject } from '@ember/component/helper';
import PowerSelect from 'ember-power-select/components/power-select';
import cn from '@cardstack/boxel/helpers/cn';
import or from 'ember-truth-helpers/helpers/or';
import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    min: number;
    max: number;
    onNumberSelected: (num: number) => void;
    placeholder?: string;
    triggerComponent?: string;
  };
  Blocks: EmptyObject;
}

export default class BoxelInputRangedNumberPicker extends Component<Signature> {
  @tracked selectedNumber: string | undefined = undefined;

  @action setSelectedNumber(number: string): void {
    this.selectedNumber = number;
    this.args.onNumberSelected(parseInt(number));
  }

  get rangedNumbers(): Array<string> {
    const { min, max } = this.args;
    const length = max - min + 1;

    const items = Array.from({ length }, (_, i) => {
      const currentNumber = min + i;

      return currentNumber.toString();
    });

    return items;
  }

  <template>
    <PowerSelect
      class={{cn
        "boxel-ranged-number-picker"
        boxel-ranged-number-picker--selected=this.selectedNumber
      }}
      ...attributes
      @options={{this.rangedNumbers}}
      @selected={{this.selectedNumber}}
      @placeholder={{or @placeholder "Pick Number"}}
      @onChange={{this.setSelectedNumber}}
      @renderInPlace={{true}}
      @dropdownClass="boxel-ranged-number-picker__dropdown"
      @triggerComponent={{@triggerComponent}}
      as |item|
    >
      <div class="boxel-ranged-number-picker__item">{{item}}</div>
    </PowerSelect>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Input::RangedNumberPicker': typeof BoxelInputRangedNumberPicker;
  }
}
