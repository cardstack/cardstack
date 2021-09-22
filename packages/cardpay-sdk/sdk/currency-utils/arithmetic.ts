/**
 * This file contains functions that perform arithmetic operations.
 * Use these over bn.js math methods if you want to use floating point numbers.
 *
 * These should handle NaN, +-0, and Infinity the same way as js
 * See https://mikemcl.github.io/bignumber.js/#prototype-methods
 *
 * bignumber.js documentation on errors may apply to these operations:
 * https://mikemcl.github.io/bignumber.js/#Errors
 */
import BigNumber from 'bignumber.js';
import { BigNumberish } from './types';

/**
 * Subtracts numberTwo from numberOne
 *
 * @returns String representation of the number obtained from subtracting numberTwo from numberOne
 */
export const subtract = (numberOne: BigNumberish, numberTwo: BigNumberish): string =>
  new BigNumber(numberOne).minus(new BigNumber(numberTwo)).toFixed();

/**
 * Calculates numberOne % numberTwo
 */
export const mod = (numberOne: BigNumberish, numberTwo: BigNumberish): string =>
  new BigNumber(numberOne).mod(new BigNumber(numberTwo)).toFixed();

/**
 * Divides numberOne by numberTwo and takes the integer portion of the calculated value
 *
 * ```
 * floorDivide(5, 3) // '1'
 * floorDivide(7, 3) // '2'
 * floorDivide(-10, 3) // '-3'
 * ```
 * @param  {Number}   numberOne
 * @param  {Number}   numberTwo
 */
export const floorDivide = (numberOne: BigNumberish, numberTwo: BigNumberish): string =>
  new BigNumber(numberOne).dividedToIntegerBy(new BigNumber(numberTwo)).toFixed();

/**
 * Calculates `numberOne + numberTwo`
 */
export const add = (numberOne: BigNumberish, numberTwo: BigNumberish): string =>
  new BigNumber(numberOne).plus(numberTwo).toFixed();

/**
 * Calculates `numberOne * numberTwo`
 */
export const multiply = (numberOne: BigNumberish, numberTwo: BigNumberish): string =>
  new BigNumber(numberOne).times(numberTwo).toFixed();

/**
 * Calculates `numberOne / numberTwo`. Handles division by zero by returning zero
 *
 */
export const divide = (numberOne: BigNumberish, numberTwo: BigNumberish): string => {
  if (!(numberOne || numberTwo)) return '0';
  return new BigNumber(numberOne).dividedBy(numberTwo).toFixed();
};

/**
 * Calculates `target * numerator / denominator`, rounded to an integer.
 * Handles division by zero by returning zero
 */
export const fraction = (target: BigNumberish, numerator: BigNumberish, denominator: BigNumberish): string => {
  if (!target || !numerator || !denominator) return '0';
  return new BigNumber(target).times(numerator).dividedBy(denominator).toFixed(0);
};
