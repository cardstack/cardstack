// ideally we would want to just use parseEther from @ethersproject/units
// but there seems to be a typescript incompatibility between BigNumber produced by that
// and BigNumber imported from @ethersproject/bignumber
import { BigNumber, FixedNumber } from '@ethersproject/bignumber';

export function amountInWei(amount: FixedNumber, decimals: number = 18) {
  const strAmount = amount.toString();
  // as long as amount is a valid fixed number, we should have get a floating point as a string
  // even if it's 0
  const floatingDecimals = strAmount.match(/\d+\.(\d+)/)![1].length;
  const number = strAmount.replace('.', '');
  return BigNumber.from(number).mul(
    BigNumber.from(10).pow(BigNumber.from(decimals - floatingDecimals))
  );
}
