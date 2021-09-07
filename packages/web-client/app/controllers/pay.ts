import { spendToUsd } from '@cardstack/cardpay-sdk';
import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';

export default class CardPayMerchantServicesController extends Controller {
  queryParams = ['amount'];
  @tracked amount: number = 0;

  @tracked hamburgerMenuOpen = false;
  get usdAmount() {
    return spendToUsd(this.amount ?? 0);
  }
  get paymentURL() {
    return `cardwallet://pay/${this.model.network}/${this.model.merchantSafeID}?amount=${this.amount}`;
  }
  @tracked canDeepLink = false;
}
