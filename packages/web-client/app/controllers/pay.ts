import {
  convertAmountToNativeDisplay,
  roundAmountToNativeCurrencyDecimals,
  generateMerchantPaymentUrl,
  isSupportedCurrency,
  spendToUsd,
} from '@cardstack/cardpay-sdk';
import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { usdToSpend } from '@cardstack/cardpay-sdk';
import { inject as service } from '@ember/service';
import IsIOS from '../services/is-ios';
import { useResource } from 'ember-resources';
import { MerchantInfo } from '../resources/merchant-info';
import config from '@cardstack/web-client/config/environment';
import { formatAmount } from '../helpers/format-amount';
import { MIN_PAYMENT_AMOUNT_IN_SPEND } from '@cardstack/cardpay-sdk/sdk/do-not-use-on-chain-constants';

const minSpendAmount = MIN_PAYMENT_AMOUNT_IN_SPEND;
const minUsdAmount = spendToUsd(minSpendAmount)!;

export default class CardPayMerchantServicesController extends Controller {
  @service('is-ios') declare isIOSService: IsIOS;
  queryParams = ['amount', 'currency'];
  @tracked amount: number = 0;
  @tracked currency: string = 'SPD';
  merchantInfo = useResource(this, MerchantInfo, () => ({
    infoDID: this.model.merchantSafe.infoDID,
  }));

  get canDeepLink() {
    return this.isIOSService.isIOS();
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
      !(isSupportedCurrency(this.currency) || this.currency === 'SPD') ||
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
          amount: `§${formatAmount(amount)}`,
          secondaryAmount: convertAmountToNativeDisplay(
            spendToUsd(amount)!,
            'USD'
          ),
        },
      };
    } else if (this.currency === 'USD') {
      let amount = Math.max(
        Number(roundAmountToNativeCurrencyDecimals(this.amount, 'USD')),
        minUsdAmount
      );
      return {
        amount,
        displayed: {
          amount: convertAmountToNativeDisplay(amount, 'USD'),
          secondaryAmount: `§${formatAmount(usdToSpend(Number(amount))!)}`,
        },
      };
    } else {
      let rate = this.model.exchangeRates?.[this.currency];
      let amount: number;
      let formattedSpendAmount: string | undefined;
      if (rate) {
        let minAmount = minUsdAmount * rate;
        amount = Number(
          roundAmountToNativeCurrencyDecimals(
            Math.max(this.amount, minAmount),
            this.currency
          )
        );
        formattedSpendAmount = `§${formatAmount(usdToSpend(amount / rate))}`;
      } else {
        amount = Number(
          roundAmountToNativeCurrencyDecimals(this.amount, this.currency)
        );
        formattedSpendAmount = undefined;
      }

      return {
        amount,
        displayed: {
          amount: convertAmountToNativeDisplay(amount, this.currency),
          secondaryAmount: formattedSpendAmount,
        },
      };
    }
  }

  get isValidAmount() {
    return !isNaN(this.amount) && this.amount > 0 && this.amount !== Infinity;
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
