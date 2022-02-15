import {
  countDecimalPlaces,
  formatCurrencyAmount,
} from '@cardstack/cardpay-sdk';
import Helper from '@ember/component/helper';

type FormatAmountHelperParams = [number | string, number];

export function formatAmount(
  amount: number | string | null | undefined,
  minDecimals: number = 0
): string {
  if (amount == null || amount === undefined) {
    return '';
  }

  let amountWithoutFloatingPointRoundingError = parseFloat(
    amount as string
  ).toPrecision(15); // 15 for 64-bit float precision
  // 23.240000000000002 -> 23.2400000000000

  let amountWithoutTrailingZeros = parseFloat(
    amountWithoutFloatingPointRoundingError
  ); // 23.2400000000000 -> 23.24

  return formatCurrencyAmount(
    amountWithoutTrailingZeros,
    Math.max(minDecimals, countDecimalPlaces(amountWithoutTrailingZeros))
  );
}

class FormatAmountHelper extends Helper {
  compute([amount, minDecimals]: FormatAmountHelperParams /*, hash*/) {
    return formatAmount(amount, minDecimals);
  }
}

export default FormatAmountHelper;
