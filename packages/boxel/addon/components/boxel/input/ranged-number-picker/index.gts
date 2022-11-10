import { action } from '@ember/object';
import Component from '@glimmer/component';
import { type EmptyObject } from '@ember/component/helper';
import BoxelSelect from '@cardstack/boxel/components/boxel/select';
import BoxelDropdownTrigger from '@cardstack/boxel/components/boxel/dropdown/trigger';
import cn from '@cardstack/boxel/helpers/cn';
import not from 'ember-truth-helpers/helpers/not';
import or from 'ember-truth-helpers/helpers/or';
import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    min: number;
    max: number;
    value?: number;
    onChange: (val: number) => void;
    icon?: string;
    placeholder?: string;
  };
  Blocks: EmptyObject;
}

export default class BoxelInputRangedNumberPicker extends Component<Signature> {
  @action setSelectedNumber(number: string): void {
    this.args.onChange(parseInt(number));
  }
  get placeholder() {
    return this.args.placeholder || 'Pick Number';
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
    <BoxelSelect
      class={{cn
        "boxel-ranged-number-picker"
        boxel-ranged-number-picker--selected=@value
      }}
      ...attributes
      @options={{this.rangedNumbers}}
      @selected={{@value}}
      @placeholder={{this.placeholder}}
      @onChange={{this.setSelectedNumber}}
      @renderInPlace={{true}}
      @dropdownClass="boxel-ranged-number-picker__dropdown"
      @triggerComponent={{component BoxelDropdownTrigger
        icon=@icon
        label=(or @value this.placeholder)
        isMissingValue=(not @value)
      }}
      as |item itemCssClass|
    >
      <div class={{cn itemCssClass "boxel-ranged-number-picker__item"}}>
        {{item}}
      </div>
    </BoxelSelect>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Input::RangedNumberPicker': typeof BoxelInputRangedNumberPicker;
  }
}
