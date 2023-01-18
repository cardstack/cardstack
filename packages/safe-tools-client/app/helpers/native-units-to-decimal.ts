import { helper } from '@ember/component/helper';
import { BigNumber, utils as ethersUtils } from 'ethers';

type PositionalArgs = [BigNumber, number, number?];

interface Signature {
  Args: {
    Positional: PositionalArgs;
  };
  Return: string;
}

export function nativeUnitsToDecimal([
  amount,
  tokenDecimals,
  decimals = undefined,
]: PositionalArgs) {
  const number = parseFloat(ethersUtils.formatUnits(amount, tokenDecimals));
  if (decimals) {
    return number.toFixed(decimals);
  } else {
    return String(number % 1 === 0 ? number : number.toFixed(3));
  }
}

export default helper<Signature>(nativeUnitsToDecimal);
