import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import './usage.css';

export default class ExpandableBannerUsage extends Component {
  @tracked icon = 'payment';
  @tracked summary = 'Deposit funds to become a Supplier';

  @tracked minHeight = '5rem';
  @tracked minHeightOpen = '15rem';
  @tracked textColor = 'var(--boxel-light)';
  @tracked backgroundColor = 'var(--boxel-purple-400)';
  @tracked verticalGap = 'var(--boxel-sp)';
  @tracked horizontalGap = 'var(--boxel-sp-lg)';
}
