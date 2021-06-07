import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class extends Component {
  @tracked selectedItemCount = 0;
  @tracked isSelected = false;
  @tracked mode = 'view';

  @action setSelectedItemCount(val: number | string): void {
    val = Number(val);
    this.selectedItemCount = val;
    this.isSelected = val === 50;
  }

  @action setIsSelected(val: boolean): void {
    this.isSelected = val;
    this.selectedItemCount = val ? 50 : 0;
  }

  @action toggleSelectAll(): void {
    if (this.isSelected) {
      this.isSelected = false;
      this.selectedItemCount = 0;
    } else {
      this.isSelected = true;
      this.selectedItemCount = 50;
    }
  }
}
