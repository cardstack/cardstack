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
  decimals = 3,
]: PositionalArgs) {
  const number = parseFloat(ethersUtils.formatUnits(amount, tokenDecimals));
  return String(number % 1 === 0 ? number : number.toFixed(decimals));
}

export default helper<Signature>(nativeUnitsToDecimal);
