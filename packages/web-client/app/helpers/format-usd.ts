import { helper } from '@ember/component/helper';
import { convertAmountToNativeDisplay } from '@cardstack/cardpay-sdk';

export default helper(([usdAmount]: [number]) => {
  if (usdAmount || usdAmount === 0) {
    return convertAmountToNativeDisplay(usdAmount, 'USD');
  }
  return undefined;
});
