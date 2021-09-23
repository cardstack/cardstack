/**
 * This file contains functions that convert amounts to other amounts.
 * Note that some functions in this file may round their results.
 */

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { multiply } from './arithmetic';
import { isZero } from './comparison';
import { BigNumberish } from './types';

/**
 * Converts a human-readable amount to an amount friendly for specifying on-chain transactions.
 * Returns `value * 10**decimals`
 *
 * @see {@link convertRawAmountToDecimalFormat}
 */
export const convertAmountToRawAmount = (value: BigNumberish, decimals: number | string): string =>
  new BigNumber(value).times(new BigNumber(10).pow(decimals)).toFixed();

/**
 * Calculates `value / priceUnit`, rounded down to specified `decimals` (default 18).
 * Handles division by zero by returning zero
 */
export const convertAmountFromNativeValue = (
  value: BigNumberish,
  priceUnit: BigNumberish | null,
  decimals = 18
): string => {
  if (isNil(priceUnit) || isZero(priceUnit)) return '0';
  return new BigNumber(new BigNumber(value).dividedBy(priceUnit).toFixed(decimals, BigNumber.ROUND_DOWN)).toFixed();
};

/**
 * This is basically multiply, but more intent-revealing when used in the wallet?
 * @see {@link multiply}
 */
export const convertAmountToNativeAmount = (amount: BigNumberish, priceUnit: BigNumberish): string =>
  multiply(amount, priceUnit);

/**
 * Returns `value / 100`, rounded to specified `decimals`
 */
export const convertBipsToPercentage = (value: BigNumberish, decimals = 2): string =>
  new BigNumber(value).shiftedBy(-2).toFixed(decimals);

/**
 * Returns `value / 10**decimals`. See {@link BigNumber.dividedBy} for detailed information on how division is handled.
 */
export const convertRawAmountToDecimalFormat = (value: BigNumberish, decimals = 18): string =>
  new BigNumber(value).dividedBy(new BigNumber(10).pow(decimals)).toFixed();

/**
 * Converts wei to ether - Returns `number / 10**18`.
 */
export const fromWei = (number: BigNumberish): string => convertRawAmountToDecimalFormat(number, 18);

const SPEND_TO_USD_RATE = 0.01;
/**
 * Converts SPEND to USD by multiplying `amountInSpend` by 0.01
 * Returns `0` if `amountInSpend` is an empty string,
 * and otherwise `undefined` if amountInSpend is not a number.
 *
 * @see {@link usdToSpend}
 */
export const spendToUsd = (amountInSpend: number): number | undefined => {
  if ((amountInSpend as unknown) === '') {
    return 0;
  }
  if (typeof (amountInSpend as unknown) !== 'number') {
    return undefined;
  }
  return amountInSpend * SPEND_TO_USD_RATE;
};

/**
 * Converts USD to SPEND by dividing `amountInUsd` by 0.01.
 * The amount is rounded up to the nearest integer.
 * Returns `0` if `amountInUsd` is an empty string,
 * and otherwise `undefined` if amountInUsd is not a number.
 *
 * @see {@link spendToUsd}
 */
export const usdToSpend = (amountInUsd: number): number | undefined => {
  if ((amountInUsd as unknown) === '') {
    return 0;
  }
  if (typeof (amountInUsd as unknown) !== 'number') {
    return undefined;
  }

  return Math.ceil(amountInUsd / SPEND_TO_USD_RATE);
};
