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

  let initialValueInEther: string = fromWei(amountInSmallestUnit);
  let valueInEther: string;
  let decimals: number;

  if (!round) {
    valueInEther = initialValueInEther;
    decimals = Math.max(countDecimalPlaces(valueInEther), minDecimals);
  } else if (
    // does not handle negative numbers currently.
    Number(initialValueInEther) > 0.0001 &&
    Number(initialValueInEther) < 1
  ) {
    valueInEther = handleSignificantDecimals(initialValueInEther, 2, 2);
    decimals = Math.max(countDecimalPlaces(valueInEther), minDecimals);
  } else {
    valueInEther = initialValueInEther;
    decimals = minDecimals;
  }

  return formatCurrencyAmount(valueInEther, decimals);
}

class FormatWeiAmountHelper extends Helper {
  compute(
    [amountInSmallestUnit, round]: FormatWeiAmountHelperParams /*, hash*/
  ) {
    return formatWeiAmount(amountInSmallestUnit, round);
  }
}

export default FormatWeiAmountHelper;
