import { spendToUsd } from '@cardstack/cardpay-sdk';
import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { usdToSpend } from '@cardstack/cardpay-sdk';
import { inject as service } from '@ember/service';
import IsIOS from '../services/is-ios';

export default class CardPayMerchantServicesController extends Controller {
  @tracked hamburgerMenuOpen = false;
  @service('is-ios') declare isIOSService: IsIOS;

  get canDeepLink() {
    return this.isIOSService.isIOS();
  }

  queryParams = ['amount', 'currency'];
  @tracked amount: number = 0; // fix amount being 0 when unspecified
  @tracked currency: string = 'SPD';

  get displayedAmounts() {
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
    return !(
      isNaN(this.amount) ||
      (this.currency === 'SPD' && this.amount % 1 > 0)
    );
  }
  get paymentURL() {
    let base = `cardwallet://pay/${this.model.network}/${this.model.merchantSafeID}`;
    let params = new URLSearchParams();
    if (this.isValidAmount) {
      params.append('amount', `${this.amount}`);
    }

    params.append('currency', `${this.currency}`);
    let queryString = params.toString();
    return base + (queryString ? '?' + queryString : '');
  }
}
