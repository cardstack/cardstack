import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';

const CARDS = [
  {
    title: 'Card A',
    amount: 100,
  },
  {
    title: 'Card B',
    amount: 1000,
  },
  {
    title: 'Card C',
    amount: 10000,
  },
];

export default class extends Component {
  @tracked cards = A(CARDS);
  @tracked selectedItem: Record<string, unknown> | null = null;

  @action chooseItem(c: Record<string, unknown> | null): void {
    this.selectedItem = c;
  }
}
