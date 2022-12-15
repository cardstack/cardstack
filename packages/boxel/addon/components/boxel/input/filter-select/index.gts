import Component from '@glimmer/component';
import BoxelSelect from '../../select';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { guidFor } from '@ember/object/internals';
import cn from '@cardstack/boxel/helpers/cn';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    disabled?: boolean;
    errorMessage?: string;
    invalid?: boolean;
    label: string;
    options: any[];
    value?: any;
    onChooseFilter: (selected: any) => void;
    onBlur?: (ev: FocusEvent) => void;
  };
}

export default class FilterSelect extends Component<Signature> {
  helperId = guidFor(this);
  @action onBlur(_select: any, ev: FocusEvent): void {
    this.args.onBlur?.(ev);
  }
  @tracked selectedItem: any = this.args.value ?? this.args.options[0];
  @action onSelectItem(_selected: any) {
    this.selectedItem = _selected;
    this.args.onChooseFilter(_selected);
  }
  <template>
    <div class={{cn
          "boxel-input-filter-select"
          boxel-input-filter-select--disabled=@disabled
        }}>
      <div class="boxel-input-filter-select__label">
        {{@label}} :
      </div>
      <BoxelSelect
        @options={{@options}}
        @selected={{this.selectedItem}}
        @disabled={{@disabled}}
        @onChange={{this.onSelectItem}}
        @onBlur={{this.onBlur}}
        @verticalPosition="below"
        aria-invalid={{if @invalid "true"}}
        class="boxel-input-filter-select__dropdown"
        ...attributes
        as |item|
      >
        <div class="boxel-input-filter-select__dropdown-item">
          {{item}}
        </div>
      </BoxelSelect>
    </div>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Input::FilterSelect': typeof FilterSelect;
  }
}
