import { helper } from '@ember/component/helper';
import { spendToUsd } from '@cardstack/cardpay-sdk';

export default helper(([amountInSpend]: [number]) => {
  return spendToUsd(amountInSpend);
});
