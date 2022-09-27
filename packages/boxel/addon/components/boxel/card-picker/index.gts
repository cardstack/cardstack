import Component from '@glimmer/component';
import PowerSelect from 'ember-power-select/components/power-select';
import cn from '@cardstack/boxel/helpers/cn';
import SelectedItemComponent from './selected-item';
import '@cardstack/boxel/styles/global.css';
import './index.css';

export interface PickableCard {
  id: string;
  type: string;
  name: string;
  description: string;
  disabled?: boolean;
};

interface Signature {
  Element: HTMLDivElement;
  Args: {
    items: PickableCard[];
    selectedItem?: PickableCard;
    chooseItem: (selection: any, select: any, event?: Event | undefined) => void;
  };
  Blocks: {
    default: [PickableCard]
  }
}

export default class BoxelCardPicker extends Component<Signature> {
  get selectedOption(): PickableCard | undefined {
    if (!this.args.selectedItem) {
      return;
    }
    return this.args.items.find((item: PickableCard) => {
      if (item.id && this.args.selectedItem?.id) {
        return item.id === this.args.selectedItem.id;
      }
      return item === this.args.selectedItem;
    });
  }

  get isSelected() {
    return !!this.args.selectedItem;
  }
  <template>
    <div class={{cn "boxel-card-picker" boxel-card-picker--change-card=this.isSelected}} data-test-boxel-card-picker ...attributes>
      {{#if this.selectedOption}}
        <div class="boxel-card-picker__selected-card" data-test-boxel-card-picker-selected-card>
          {{yield this.selectedOption}}
        </div>
      {{/if}}
      <PowerSelect
        class={{cn "boxel-card-picker__dropdown" boxel-card-picker__dropdown--selected=this.isSelected}}
        @options={{@items}}
        @selected={{this.selectedOption}}
        @selectedItemComponent={{component SelectedItemComponent}}
        @placeholder="Select Card"
        @onChange={{@chooseItem}}
        @renderInPlace={{true}}
        @eventType="click"
        @verticalPosition="below"
        data-test-boxel-card-picker-dropdown
      as |item|>
        {{yield item}}
      </PowerSelect>
    </div>
  </template>
}
