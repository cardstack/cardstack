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
    Math.abs(Number(initialValueInEther)) > 0.0001 &&
    Math.abs(Number(initialValueInEther)) < 1
  ) {
    // handleSignificantDecimals doesn't work properly with numbers that are less than 0 && greater than -1
    // There is a way to fix this in the SDK, but am being cautious about any "bug as a feature" use of this function
    // This hack is temporary, until we address that
    let isNegative = Number(initialValueInEther) < 0;
    valueInEther = isNegative
      ? '-' +
        handleSignificantDecimals(initialValueInEther.replace(/^-/, ''), 2, 2)
      : handleSignificantDecimals(initialValueInEther, 2, 2);
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
