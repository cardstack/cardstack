import {
  countDecimalPlaces,
  formatCurrencyAmount,
  handleSignificantDecimals,
} from '@cardstack/cardpay-sdk';
import Helper from '@ember/component/helper';
import BN from 'bn.js';
import { fromWei } from 'web3-utils';

type FormatWeiAmountHelperParams = [BN, boolean?];

export function formatWeiAmount(
  amountInSmallestUnit: BN,
  round: boolean = true
): string {
  if (amountInSmallestUnit == null) {
    return '';
  }

  const minDecimals = 2;

  let result: string | number = Number(fromWei(amountInSmallestUnit));
  if (!round) {
    // return the exact same amount of decimal places if truncation should not occur
    return formatCurrencyAmount(
      result,
      Math.max(countDecimalPlaces(result), minDecimals)
    );
  } else if (Math.abs(result) > 0.0001 && Math.abs(result) < 1) {
    result = handleSignificantDecimals(result, 2, 2);
    return formatCurrencyAmount(
      result,
      Math.max(countDecimalPlaces(result), minDecimals)
    );
  } else {
    // by default, just truncate to 2 decimal places
    return formatCurrencyAmount(result, minDecimals);
  }
}

class FormatWeiAmountHelper extends Helper {
  compute(
    [amountInSmallestUnit, round]: FormatWeiAmountHelperParams /*, hash*/
  ) {
    return formatWeiAmount(amountInSmallestUnit, round);
  }
}

export default FormatWeiAmountHelper;
