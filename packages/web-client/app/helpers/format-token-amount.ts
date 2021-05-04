import Helper from '@ember/component/helper';
import { BigNumber } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';

type FormatTokenAmountHelperParams = [BigNumber];

class FormatTokenAmountHelper extends Helper {
  compute([amountInSmallestUnit]: FormatTokenAmountHelperParams /*, hash*/) {
    if (amountInSmallestUnit == null) {
      return null;
    }
    return formatUnits(amountInSmallestUnit);
  }
}

export default FormatTokenAmountHelper;
