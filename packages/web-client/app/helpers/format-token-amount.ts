import Helper from '@ember/component/helper';
import { inject as service } from '@ember/service';
import TextFormattingService from '../services/text-formatting';
import { BigNumber } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';

type FormatTokenAmountHelperParams = [BigNumber];

class FormatTokenAmountHelper extends Helper {
  @service declare textFormatting: TextFormattingService;
  compute([amountInSmallestUnit]: FormatTokenAmountHelperParams /*, hash*/) {
    if (amountInSmallestUnit == null) {
      return null;
    }
    return formatUnits(amountInSmallestUnit);
  }
}

export default FormatTokenAmountHelper;
