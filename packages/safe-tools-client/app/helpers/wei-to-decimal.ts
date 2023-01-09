import { convertRawAmountToDecimalFormat } from '@cardstack/cardpay-sdk';
import { helper } from '@ember/component/helper';
import { BigNumber } from 'ethers';

type PositionalArgs = [BigNumber, number, number?];

interface Signature {
  Args: {
    Positional: PositionalArgs;
  };
  Return: string;
}

export function weiToDecimal([
  amount,
  tokenDecimals,
  decimals = 3,
]: PositionalArgs) {
  const number = parseFloat(
    convertRawAmountToDecimalFormat(amount.toString(), tokenDecimals)
  );
  return String(number % 1 === 0 ? number : number.toFixed(decimals));
}

export default helper<Signature>(weiToDecimal);
