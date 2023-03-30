import { helper } from '@ember/component/helper';
import { BigNumber, utils as ethersUtils } from 'ethers';

type PositionalArgs = [BigNumber, number, number?];

interface Signature {
  Args: {
    Positional: PositionalArgs;
  };
  Return: string;
}

export function roundDecimals(number: number, decimals: number) {
  // Below is a special case for numbers betweeon 0 and 1 whose first significant decimal digit comes after the rounding point.
  // For example we want to round to to 3 decimals, but the number is 0.0000001. In this case if we use toFixed(3),
  // we will get 0, but in this case we want to keep 0.0000001 to not throw away the significant part.
  if (number < 1 && number % 1 !== 0) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    const match = number.toString().match(/(\.0*)/);
    if (match) {
      const leadingZerosInDecimal = match[0].length - 1;
      if (leadingZerosInDecimal > decimals) {
        return number.toFixed(leadingZerosInDecimal + 1);
      }
    }
  }

  return number.toFixed(decimals);
}

export function nativeUnitsToDecimal([
  amount,
  tokenDecimals,
  decimals = undefined,
]: PositionalArgs) {
  const number = parseFloat(ethersUtils.formatUnits(amount, tokenDecimals));

  if (decimals) {
    return roundDecimals(number, decimals);
  } else {
    return String(number % 1 === 0 ? number : roundDecimals(number, 3));
  }
}

export default helper<Signature>(nativeUnitsToDecimal);
