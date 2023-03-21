/**
 * This file contains functions that compare numbers against each other or against
 * constants.
 */

import BigNumber from 'bignumber.js';
import { BigNumberish } from './types';

/**
 * Checks if numberOne is greater than numberTwo
 * @group Utils
 * @category Currency
 */
export const greaterThan = (numberOne: BigNumberish, numberTwo: BigNumberish): boolean =>
  new BigNumber(numberOne).gt(numberTwo);

/**
 * Checks if numberOne is greater than or equal to numberTwo
 * @group Utils
 * @category Currency
 */
export const greaterThanOrEqualTo = (numberOne: BigNumberish, numberTwo: BigNumberish): boolean =>
  new BigNumber(numberOne).gte(numberTwo);

/**
 * Checks if numberOne is equal to numberTwo
 * @group Utils
 * @category Currency
 */
export const isEqual = (numberOne: BigNumberish, numberTwo: BigNumberish): boolean =>
  new BigNumber(numberOne).eq(numberTwo);

/**
 * Checks whether `value` is zero or not
 * @group Utils
 * @category Currency
 */
export const isZero = (value: BigNumberish): boolean => new BigNumber(value).isZero();

/**
 * Checks if `numberOne` is less than `numberTwo`
 * @group Utils
 * @category Currency
 */
export const lessThan = (numberOne: BigNumberish, numberTwo: BigNumberish): boolean =>
  new BigNumber(numberOne).lt(numberTwo);
