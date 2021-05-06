import Helper from '@ember/component/helper';
import { inject as service } from '@ember/service';
import TextFormattingService from '../services/text-formatting';
import BN from 'bn.js';
import { fromWei } from 'web3-utils';

type FormatTokenAmountHelperParams = [BN];

class FormatTokenAmountHelper extends Helper {
  @service declare textFormatting: TextFormattingService;
  compute([amountInSmallestUnit]: FormatTokenAmountHelperParams /*, hash*/) {
    if (amountInSmallestUnit == null) {
      return null;
    }
    let result = fromWei(amountInSmallestUnit).toString();
    if (!result.includes('.')) {
      result = `${result}.0`;
    }
    return result;
  }
}

export default FormatTokenAmountHelper;
