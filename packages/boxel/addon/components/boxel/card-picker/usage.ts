import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';

const CARDS = [
  {
    id: 'pia-midina',
    type: 'participant',
    name: 'Pia Midina',
    description: 'Recording artist & lyricist',
  },
  {
    id: 'jenny-sparks',
    type: 'participant',
    name: 'Jenny Sparks',
    description: 'Background singer',
  },
  {
    id: 'francesco-midina',
    type: 'participant',
    name: 'Francesco Midina',
    description: 'Producer (Francesco Rocks)',
    disabled: true,
  },
  {
    id: 'joel-kaplan',
    type: 'participant',
    name: 'Joel Kaplan',
    description: 'Mastering engineer',
    disabled: true,
  },
  {
    id: 'mariah-solis',
    type: 'participant',
    name: 'Mariah Solis',
    description: 'Mixing engineer',
  },
];

export default class extends Component {
  @tracked cards = A(CARDS);
  @tracked selectedItem: Record<string, unknown> | null = null;

  @action chooseItem(c: Record<string, unknown> | null): void {
    this.selectedItem = c;
  }
}
