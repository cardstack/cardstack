import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class ExpandableBannerUsage extends Component {
  @tracked icon = 'payment';
  @tracked summary = 'Deposit funds to become a Supplier';
}
