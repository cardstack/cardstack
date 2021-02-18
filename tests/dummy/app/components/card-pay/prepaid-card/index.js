import Component from '@glimmer/component';
import { reads } from 'macro-decorators';

export default class PrepaidCard extends Component {
  @reads('args.headerColor', 'var(--boxel-lime)') headerColor;
  @reads('args.headerPattern', 'none') headerPattern;

  get usdBalance() {
    // TODO: Need conversion rate
    return this.args.balance * 1;
  }

  get shortAddress() {
    if (!this.args.accountAddress) {
      return '';
    }

    return `${this.args.accountAddress.slice(
      0,
      6
    )}...${this.args.accountAddress.slice(-4)}`;
  }
}
