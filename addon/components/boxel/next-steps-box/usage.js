import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';

const NEXT_STEPS = [
  'Transfer Prepaid Card',
  'Create new Prepaid Card',
  'Split Prepaid Card',
  'Use as template for new Prepaid Card',
];

export default class extends Component {
  @tracked items = A(NEXT_STEPS);
}
