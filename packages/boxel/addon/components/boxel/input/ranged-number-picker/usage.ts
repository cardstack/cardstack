import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class BoxelInputRangedNumberPickerUsage extends Component {
  @tracked min = 1;
  @tracked max = 30;
  @tracked selectedNumber: number | undefined = undefined;

  @action setSelectedNumber(number: number): void {
    this.selectedNumber = number;
  }
}
