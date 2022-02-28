import {
  convertAmountToNativeDisplay,
  roundAmountToNativeCurrencyDecimals,
  generateMerchantPaymentUrl,
  isSupportedCurrency,
  spendToUsd,
} from '@cardstack/cardpay-sdk';
import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { convertToSpend } from '@cardstack/cardpay-sdk';
import { inject as service } from '@ember/service';
import UA from '../services/ua';
import config from '@cardstack/ssr-web/config/environment';
import { MIN_PAYMENT_AMOUNT_IN_SPEND__PREFER_ON_CHAIN_WHEN_POSSIBLE as MIN_PAYMENT_AMOUNT_IN_SPEND } from '@cardstack/cardpay-sdk';

const minSpendAmount = MIN_PAYMENT_AMOUNT_IN_SPEND;

export default class PayController extends Controller {
  @service('ua') declare UAService: UA;
  queryParams = ['amount', 'currency'];
  @tracked amount: number = 0;
  @tracked currency: string = 'SPD';

  get canDeepLink() {
    return this.UAService.isIOS() || this.UAService.isAndroid();
  }
  get cleanedAmounts() {
    if (!this.isValidAmount) {
      return {
        amount: 0,
        displayed: {
          amount: '',
          secondaryAmount: '',
        },
      };
    } else if (
      !isSupportedCurrency(this.currency) ||
      this.currency === 'DAI' ||
      this.currency === 'CARD' ||
      this.currency === 'ETH'
    ) {
      return {
        amount: this.amount,
        displayed: {
          amount: '',
          secondaryAmount: '',
        },
      };
    } else if (this.currency === 'SPD') {
      let amount = Math.max(Math.ceil(this.amount), minSpendAmount);
      return {
        amount,
        displayed: {
          amount: convertAmountToNativeDisplay(spendToUsd(amount)!, 'USD'),
        },
      };
    } else if (this.currency === 'USD') {
      let amount = Math.max(
        Number(roundAmountToNativeCurrencyDecimals(this.amount, 'USD')),
        spendToUsd(minSpendAmount)!
      );
      return {
        amount,
        displayed: {
          amount: convertAmountToNativeDisplay(amount, 'USD'),
        },
      };
    } else {
      let rate = this.model.exchangeRates?.[this.currency];
      let amount: number;
      let usdAmount: string | undefined;
      if (rate) {
        amount = Number(
          roundAmountToNativeCurrencyDecimals(this.amount, this.currency)
        );
        let spendAmount = convertToSpend(amount, this.currency, rate);

        if (spendAmount < minSpendAmount) {
          amount = spendToUsd(minSpendAmount)! * rate;
          spendAmount = convertToSpend(amount, this.currency, rate);
        }

        usdAmount = convertAmountToNativeDisplay(
          spendToUsd(spendAmount)!,
          'USD'
        );
      } else {
        amount = Number(
          roundAmountToNativeCurrencyDecimals(this.amount, this.currency)
        );
        usdAmount = undefined;
      }

      return {
        amount,
        displayed: {
          amount: convertAmountToNativeDisplay(amount, this.currency),
          secondaryAmount: usdAmount,
        },
      };
    }
  }

  get isValidAmount() {
    return !isNaN(this.amount) && this.amount > 0 && this.amount !== Infinity;
  }

  get merchantInfo() {
    return this.model.merchantInfo;
  }

  // This is necessary because iOS respects users' decisions to visit your site
  // and will stay on the site if the link has the same domain
  // see https://developer.apple.com/library/archive/documentation/General/Conceptual/AppSearch/UniversalLinks.html
  // also might be useful for folks on older versions of iOS (~9)
  get deepLinkPaymentURL() {
    return generateMerchantPaymentUrl({
      network: this.model.network,
      merchantSafeID: this.model.merchantSafe.address,
      currency: this.currency,
      amount: this.cleanedAmounts.amount,
    });
  }

  get paymentURL() {
    return generateMerchantPaymentUrl({
      domain: config.universalLinkDomain,
      network: this.model.network,
      merchantSafeID: this.model.merchantSafe.address,
      currency: this.currency,
      amount: this.cleanedAmounts.amount,
    });
  }
}
