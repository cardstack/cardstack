import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { type EmptyObject } from '@ember/component/helper';
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
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Input::RangedNumberPicker': typeof BoxelInputRangedNumberPicker;
  }
}
