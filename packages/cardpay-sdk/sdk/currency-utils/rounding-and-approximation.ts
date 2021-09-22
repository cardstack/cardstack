/**
 * This file contains functions that round or truncate numbers.
 */

import BigNumber from 'bignumber.js';
import { get } from 'lodash';
import { countDecimalPlaces, isSupportedCurrency } from './formatting-plus-plus';
import { BigNumberish } from './types';
import supportedNativeCurrencies from '../native-currencies';
import { convertNumberToString, convertStringToNumber } from './type-conversion';
import { lessThan } from './comparison';

/**
 * Rounds a number to the specified set of decimals. If decimals is undefined, the amount will be returned as is
 * @see formatFixedDecimals:
 * this function fulfils a similar purpose but cuts off trailing zeroes in decimals, and also throws
 * when decimals is undefined
 *
 * @param value - BigNumberish
 * @param decimals - number of decimals
 *
 * @returns value rounded to the number of decimals specified
 */
export const toFixedDecimals = (value: BigNumberish, decimals: number): string =>
  new BigNumber(value).toFixed(decimals);

/**
 * Rounds a number to the specified set of decimals, removing trailing zeroes. If decimals is undefined, this will throw an error
 * @see toFixedDecimals:
 * this function fulfils a similar purpose but does not cut off trailing zeroes
 * in decimals if they are within the decimals specified
 *
 * @param value - BigNumberish
 * @param decimals - number of decimals
 *
 * @returns string representing value rounded to the number of decimals specified
 */
export const formatFixedDecimals = (value: BigNumberish, decimals: number): string => {
  const _value = convertNumberToString(value);
  const _decimals = convertStringToNumber(decimals);
  return new BigNumber(new BigNumber(_value).toFixed(_decimals)).toFixed();
};

/**
 * Update the amount to display precision
 * equivalent to ~0.01 of the native price
 * or use most significant decimal
 * if the updated precision amounts to zero
 *
 * A simplification of how this is done:
 * 1. Floor `nativePrice` into an integer. Take the number of significant digits of the result as `x`. (significant digits include 0s, and 0 has 1 significant digit)
 * 2. Round `amount` to `x + 2` decimal places, rounding down, taking the result as `r`.
 * 3. If `r` is not 0 return `amount` rounded to `x + 2` decimal places,
 *     rounding up if `roundUp` is true and rounding down otherwise
 * 4. If `r` is 0, instead return `amount` truncated (not rounded) to 1 significant digit
 *
 * ```
 * updatePrecisionToDisplay(0.000357, 0.1) // '0.0003'
 * updatePrecisionToDisplay(0.000357, 10) // '0.0003'
 * updatePrecisionToDisplay(0.000357, 100) // '0.00035'
 * updatePrecisionToDisplay(0.000357, 1000) // '0.000357'
 *
 * updatePrecisionToDisplay(0.000357, 100, true) // '0.00036'
 * ```
 * @param  amount
 * @param  nativePrice
 * @param  roundUp use rounding up mode
 * @return updated amount
 */
export const updatePrecisionToDisplay = (amount: BigNumberish, nativePrice: BigNumberish, roundUp = false): string => {
  if (!amount) return '0';
  if (!nativePrice) return new BigNumber(amount).toFixed();
  const roundingMode = roundUp ? BigNumber.ROUND_UP : BigNumber.ROUND_DOWN;
  const bnAmount = new BigNumber(amount);
  const significantDigitsOfNativePriceInteger = new BigNumber(nativePrice)
    .decimalPlaces(0, BigNumber.ROUND_DOWN)
    .sd(true);
  const truncatedPrecision = new BigNumber(significantDigitsOfNativePriceInteger).plus(2, 10).toNumber();
  const truncatedAmount = bnAmount.decimalPlaces(truncatedPrecision, BigNumber.ROUND_DOWN);
  return truncatedAmount.isZero()
    ? new BigNumber(bnAmount.toPrecision(1, roundingMode)).toFixed()
    : bnAmount.decimalPlaces(truncatedPrecision, roundingMode).toFixed();
};

/**
 * Calculates `numberOne * buffer`, rounded to an integer
 *
 * @param numberOne - BigNumberish
 * @param buffer - BigNumberish
 */
export const addBuffer = (numberOne: BigNumberish, buffer: BigNumberish = '1.2'): string =>
  new BigNumber(numberOne).times(buffer).toFixed(0);

/**
 * Rounds `value` down to the number of decimals specified by the native currency (see `native-currencies.ts`)
 */
export const roundAmountToNativeCurrencyDecimals = (
  value: BigNumberish,
  currency: string,
  roundingMode = BigNumber.ROUND_UP
): string => {
  if (!isSupportedCurrency(currency)) {
    throw new Error(`Unknown currency ${currency}`);
  }

  let bnValue = new BigNumber(value);

  if (bnValue.isNaN()) {
    throw new Error(`Unable to convert ${value} to BigNumber`);
  }

  let { decimals } = get(supportedNativeCurrencies, currency);

  return bnValue.dp(decimals, roundingMode).toString();
};

/**
 * If `value` is between -1 and 1, returns `value` rounded to one of the following decimal places (whichever is smaller):
 * - 8
 * - number of decimal places to reach `value`'s first significant digit + `buffer`
 *
 * Otherwise returns `value` rounded to the smaller of `buffer` and `decimals`
 *
 * The returned value will have a minimum of 2 decimal places.
 *
 * ```
 * handleSignificantDecimals(0.123456789, 2, 3) // '0.123' - 0 decimal place to reach first significant digit, then buffer of 3
 * handleSignificantDecimals(0.0123456789, 2, 3) // '0.0123' - 1 decimal places to reach first significant digit, then buffer of 3
 * handleSignificantDecimals(0.123456789, 2, 4) // '0.1235' - 0 decimal place to reach first significant digit, then buffer of 4
 * handleSignificantDecimals(0.0123456789, 2, 4) // '0.01235' - 1 decimal places to reach first significant digit, then buffer of 4
 * handleSignificantDecimals(0.000000123456789, 2, 3) // '0.00000012' - 8 decimal limit reached
 * handleSignificantDecimals(0.00000000123456, 2, 3) // '0.00' - 8 decimal limit reached, rounded to 0, formatted to 2 decimal places
 *
 * handleSignificantDecimals(2.1234, 2, 1) // '2.10'
 * handleSignificantDecimals(2.1234, 1, 2) // '2.10' - this and the above are both Math.min(2, 1) decimals
 * ```
 */
export const handleSignificantDecimals = (value: BigNumberish, decimals: number, buffer = 3): string => {
  if (lessThan(new BigNumber(value).abs(), 1)) {
    // find the position of the first significant decimal
    // then add the buffer to it to calculate the new decimals
    decimals = new BigNumber(value).toFixed().slice(2).search(/[^0]/g) + buffer;
    decimals = Math.min(decimals, 8);
  } else {
    decimals = Math.min(decimals, buffer);
  }
  const result = new BigNumber(new BigNumber(value).toFixed(decimals)).toFixed();
  const resultBN = new BigNumber(result);
  return resultBN.dp() <= 2 ? resultBN.toFormat(2) : resultBN.toFormat();
};

/**
 * If inputTwo has more than 8 significant decimals, returns inputOne with as many significant decimals as possible up to the same amount as inputTwo
 * Otherwise returns inputOne with as many significant decimals as possible, up to 8
 *
 * ```
 * formatInputDecimals(1.123456789123, 2.123456789000) // '1.123456789'
 * formatInputDecimals(1.123456789123, 2.12345678912) // '1.12345678912'
 * formatInputDecimals(1.123456789123, 2.1) // '1.12345679'
 * ```
 * @param inputOne - BigNumberish
 * @param inputTwo - BigNumberish
 */
// TODO revisit logic, at least rename so it is not native amount dp
export const formatInputDecimals = (inputOne: BigNumberish, inputTwo: BigNumberish): string => {
  const _nativeAmountDecimalPlaces = countDecimalPlaces(inputTwo);
  const decimals = _nativeAmountDecimalPlaces > 8 ? _nativeAmountDecimalPlaces : 8;
  const result = new BigNumber(formatFixedDecimals(inputOne, decimals)).toFormat().replace(/,/g, '');
  return result;
};
