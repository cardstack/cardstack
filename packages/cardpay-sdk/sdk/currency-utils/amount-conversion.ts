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
 *
 * @param value - BigNumberish
 * @param decimals - The number of decimals the asset has
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
 * @see multiply
 */
export const convertAmountToNativeAmount = (amount: BigNumberish, priceUnit: BigNumberish): string =>
  multiply(amount, priceUnit);

/**
 * Divides `value` by 100 and rounds to specified `decimals`
 */
export const convertBipsToPercentage = (value: BigNumberish, decimals = 2): string =>
  new BigNumber(value).shiftedBy(-2).toFixed(decimals);

/**
 * Converts blockchain-friendly values to values conventionally shown to users by dividing by 10 to the power of the specified number of `decimals`
 */
export const convertRawAmountToDecimalFormat = (value: BigNumberish, decimals = 18): string =>
  new BigNumber(value).dividedBy(new BigNumber(10).pow(decimals)).toFixed();

/**
 * Converts wei to ether (divide by 10**18)
 */
export const fromWei = (number: BigNumberish): string => convertRawAmountToDecimalFormat(number, 18);

const SPEND_TO_USD_RATE = 0.01;
/**
 * Converts SPEND to USD.
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
 * Converts USD to SPEND. The amount is rounded up to the nearest integer
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
