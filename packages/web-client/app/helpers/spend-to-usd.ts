import { helper } from '@ember/component/helper';

const spendToUsdRate = 0.01;

export function spendToUsd([amountInSpend]: [number]) {
  if (!amountInSpend) {
    return 0;
  }
  if (typeof amountInSpend !== 'number') {
    return;
  }
  return amountInSpend * spendToUsdRate;
}

export default helper(spendToUsd);
