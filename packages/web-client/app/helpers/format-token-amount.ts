import Helper from '@ember/component/helper';
import BN from 'bn.js';
import { fromWei } from 'web3-utils';

type FormatTokenAmountHelperParams = [BN, number];

export function formatTokenAmount(
  amountInSmallestUnit: BN,
  minPrecision?: number
): string {
  if (amountInSmallestUnit == null) {
    return '';
  }

  // fallback to the reasonable default of 2
  // assume that non-numbers and numbers < 0 are mistakes
  if (
    minPrecision === undefined ||
    minPrecision === null ||
    isNaN(minPrecision) ||
    minPrecision < 0
  ) {
    minPrecision = 2;
  }
  let result = fromWei(amountInSmallestUnit).toString();

  if (minPrecision === 0) {
    return result;
  }

  if (!result.includes('.')) {
    result += '.';
    result = result.padEnd(minPrecision + result.length, '0');
  } else {
    let floatingDecimals = result.split('.')[1]?.length;
    if (floatingDecimals < minPrecision) {
      let difference = minPrecision - floatingDecimals;
      result = result.padEnd(difference + result.length, '0');
    }
  }

  return result;
}

class FormatTokenAmountHelper extends Helper {
  compute(
    [
      amountInSmallestUnit,
      minPrecision,
    ]: FormatTokenAmountHelperParams /*, hash*/
  ) {
    return formatTokenAmount(amountInSmallestUnit, minPrecision);
  }
}

export default FormatTokenAmountHelper;
