import {
  countDecimalPlaces,
  formatCurrencyAmount,
} from '@cardstack/cardpay-sdk';
import Helper from '@ember/component/helper';
import BN from 'bn.js';
import { fromWei } from 'web3-utils';

type FormatTokenAmountHelperParams = [BN, number];

export function formatTokenAmount(
  amountInSmallestUnit: BN,
  minDecimals?: number
): string {
  if (amountInSmallestUnit == null) {
    return '';
  }

  // fallback to the reasonable default of 2
  // assume that non-numbers and numbers < 0 are mistakes
  if (
    minDecimals === undefined ||
    minDecimals === null ||
    isNaN(minDecimals) ||
    minDecimals < 0
  ) {
    minDecimals = 2;
  }
  let result = fromWei(amountInSmallestUnit).toString();

  return formatCurrencyAmount(
    result,
    Math.max(minDecimals, countDecimalPlaces(result))
  );
}

class FormatTokenAmountHelper extends Helper {
  compute(
    [
      amountInSmallestUnit,
      minDecimals,
    ]: FormatTokenAmountHelperParams /*, hash*/
  ) {
    return formatTokenAmount(amountInSmallestUnit, minDecimals);
  }
}

export default FormatTokenAmountHelper;
