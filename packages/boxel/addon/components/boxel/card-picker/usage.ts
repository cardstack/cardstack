import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

const CARDS = [
  {
    title: 'Card A',
    amount: 100,
    unit: 'USD',
    symbol: '$',
  },
  {
    title: 'Card B',
    amount: 1000,
    unit: 'USD',
    symbol: '$',
  },
  {
    title: 'Card C',
    amount: 10000,
    unit: 'USD',
    symbol: '$',
  },
];

export default class extends Component {
  cards = CARDS;
  @tracked selectedCard: Record<string, unknown> | null = null;

  @action chooseCard(c: Record<string, unknown> | null): void {
    this.selectedCard = c;
  }
}
