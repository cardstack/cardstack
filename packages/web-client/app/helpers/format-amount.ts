import {
  countDecimalPlaces,
  formatCurrencyAmount,
} from '@cardstack/cardpay-sdk';
import Helper from '@ember/component/helper';

type FormatAmountHelperParams = [number, number];

export function formatAmount(amount: number, minDecimals: number = 0): string {
  if (amount == null || amount === undefined) {
    return '';
  }

  return formatCurrencyAmount(
    amount,
    Math.max(minDecimals, countDecimalPlaces(amount))
  );
}

class FormatWeiAmountHelper extends Helper {
  compute([amount, minDecimals]: FormatAmountHelperParams /*, hash*/) {
    return formatAmount(amount, minDecimals);
  }
}

export default FormatWeiAmountHelper;
