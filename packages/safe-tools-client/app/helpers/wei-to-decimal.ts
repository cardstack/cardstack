import { convertRawAmountToDecimalFormat } from '@cardstack/cardpay-sdk';
import { helper } from '@ember/component/helper';
import { BN } from 'bn.js';

type PositionalArgs = [typeof BN, number];

interface Signature {
  Args: {
    Positional: PositionalArgs;
  };
  Return: string;
}

export function weiToDecimal([amount, decimals]: PositionalArgs) {
  const number = parseFloat(
    convertRawAmountToDecimalFormat(amount.toString(), decimals)
  );
  return String(number % 1 === 0 ? number : number.toFixed(3));
}

export default helper<Signature>(weiToDecimal);
