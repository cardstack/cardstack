import Component from '@glimmer/component';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface BoxelCardPickerComponent {
  items: Record<string, unknown>[];
  selectedItem: Record<string, unknown>;
}

export default class BoxelCardPicker extends Component<BoxelCardPickerComponent> {
  get selectedOption(): Record<string, unknown> | undefined {
    if (!this.args.selectedItem) {
      return;
    }
    return this.args.items.find((item: Record<string, unknown>) => {
      if (item.id && this.args.selectedItem.id) {
        return item.id === this.args.selectedItem.id;
      }
      return item === this.args.selectedItem;
    });
  }
}
