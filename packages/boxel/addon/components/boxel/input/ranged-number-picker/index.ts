import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import './index.css';

interface RangedBoxelInputRangedNumberPickerInputArgs {
  min: number;
  max: number;
  onNumberSelected: (num: number) => void;
}

export default class BoxelInputRangedNumberPicker extends Component<RangedBoxelInputRangedNumberPickerInputArgs> {
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
}
