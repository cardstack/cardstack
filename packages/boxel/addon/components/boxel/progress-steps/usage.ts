import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';
import { action } from '@ember/object';
import './usage.css';

const SAMPLE_PROGRESS_STEPS = [
  {
    title: 'Place order',
    statusOnCompletion: 'Order placed',
  },
  {
    title: 'Reserve products',
    statusOnCompletion: 'Products reserved',
  },
  {
    title: 'Submit payment',
    statusOnCompletion: 'Payment submitted',
  },
  {
    title: 'Track delivery',
    statusOnCompletion: 'Delivery tracked',
  },
];

export default class ProgressStepsUsageComponent extends Component {
  @tracked progressSteps = A(SAMPLE_PROGRESS_STEPS);
  @tracked completedCount = 1;
  @action onClickStep(stepIndex: number): void {
    window.alert(`Step ${stepIndex} clicked`);
  }
}
