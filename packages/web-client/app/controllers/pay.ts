import { generateMerchantPaymentUrl, spendToUsd } from '@cardstack/cardpay-sdk';
import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { usdToSpend } from '@cardstack/cardpay-sdk';
import { inject as service } from '@ember/service';
import IsIOS from '../services/is-ios';

export default class CardPayMerchantServicesController extends Controller {
  @service('is-ios') declare isIOSService: IsIOS;
  queryParams = ['amount', 'currency'];
  @tracked amount: number = 0;
  @tracked currency: string = 'SPD';
  @tracked hamburgerMenuOpen = false;

  get canDeepLink() {
    return this.isIOSService.isIOS();
  }

  get displayedAmounts() {
    // TODO: add rounding based on currency decimal limits
    if (!this.isValidAmount) {
      return {
        SPD: null,
        USD: null,
      };
    } else if (this.currency === 'SPD') {
      return {
        SPD: this.amount,
        USD: spendToUsd(this.amount),
      };
    } else if (this.currency === 'USD') {
      return {
        SPD: usdToSpend(this.amount),
        USD: this.amount,
      };
    } else {
      return {
        SPD: null,
        USD: null,
      };
    }
  }
  get isValidAmount() {
    return !isNaN(this.amount) && this.amount > 0;
  }
  get paymentURL() {
    return generateMerchantPaymentUrl({
      network: this.model.network,
      merchantSafeID: this.model.merchantSafeID,
      currency: this.currency,
      amount: this.isValidAmount ? this.amount : 0,
    });
  }
}
