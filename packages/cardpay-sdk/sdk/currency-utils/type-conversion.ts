/**
 * This file contains functions that convert BigNumberish to hex, string, and number
 * @group Utils
 * @category Currency
 */

import BigNumber from 'bignumber.js';
import { BigNumberish } from './types';

/**
 * Converts `hex` to string
 * @group Utils
 * @category Currency
 */
export const convertHexToString = (hex: BigNumberish): string => new BigNumber(hex).toFixed();

/**
 * Converts `stringToConvert` to hex number
 * @group Utils
 * @category Currency
 */
export const convertStringToHex = (stringToConvert: string): string => new BigNumber(stringToConvert).toString(16);

/**
 * Converts `value` to a number
 * @group Utils
 * @category Currency
 */
export const convertStringToNumber = (value: BigNumberish) => new BigNumber(value).toNumber();

/**
 * Converts `value` to a string.
 * @group Utils
 * @category Currency
 */
export const convertNumberToString = (value: BigNumberish): string => new BigNumber(value).toFixed();
