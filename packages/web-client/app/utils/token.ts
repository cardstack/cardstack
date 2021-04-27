import { BigNumber } from '@ethersproject/bignumber/lib/bignumber';

export function amountInWei(amount: number, decimals: number = 18) {
  let dec = BigNumber.from(10).pow(BigNumber.from(decimals));
  return BigNumber.from(amount).mul(dec);
}
