import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';

const CARDS = [
  {
    id: 'card-a',
    title: 'Card A',
    amount: 100,
  },
  {
    id: 'card-b',
    title: 'Card B',
    amount: 1000,
  },
  {
    id: 'card-c',
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
