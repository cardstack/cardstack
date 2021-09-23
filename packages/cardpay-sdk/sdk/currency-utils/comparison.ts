/**
 * This file contains functions that compare numbers against each other or against
 * constants.
 */

import BigNumber from 'bignumber.js';
import { BigNumberish } from './types';

/**
 * Checks if numberOne is greater than numberTwo
 */
export const greaterThan = (numberOne: BigNumberish, numberTwo: BigNumberish): boolean =>
  new BigNumber(numberOne).gt(numberTwo);

/**
 * Checks if numberOne is greater than or equal to numberTwo
 */
export const greaterThanOrEqualTo = (numberOne: BigNumberish, numberTwo: BigNumberish): boolean =>
  new BigNumber(numberOne).gte(numberTwo);

/**
 * Checks if numberOne is equal to numberTwo
 */
export const isEqual = (numberOne: BigNumberish, numberTwo: BigNumberish): boolean =>
  new BigNumber(numberOne).eq(numberTwo);

/**
 * Checks whether `value` is zero or not
 */
export const isZero = (value: BigNumberish): boolean => new BigNumber(value).isZero();

/**
 * Checks if `numberOne` is less than `numberTwo`
 */
export const lessThan = (numberOne: BigNumberish, numberTwo: BigNumberish): boolean =>
  new BigNumber(numberOne).lt(numberTwo);
