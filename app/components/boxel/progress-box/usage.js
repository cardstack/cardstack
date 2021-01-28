import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

const SAMPLE_MILESTONS = [
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

export default class ProgressBoxUsageComponent extends Component {
  milestones = SAMPLE_MILESTONS;
  @tracked title = 'Customer Support';
  @tracked status = 'Products reserved';
  @tracked size = 120;
  @tracked completedCount = 2;
}
