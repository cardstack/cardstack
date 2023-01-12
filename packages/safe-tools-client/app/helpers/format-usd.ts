import { convertAmountToNativeDisplay } from '@cardstack/cardpay-sdk';
import { helper } from '@ember/component/helper';

export default helper(([usdAmount]: [number]) => {
  if (usdAmount || usdAmount === 0) {
    return convertAmountToNativeDisplay(usdAmount, 'USD');
  }
  return undefined;
});
