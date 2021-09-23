/**
 * This file contains functions that convert BigNumberish to hex, string, and number
 */

import BigNumber from 'bignumber.js';
import { BigNumberish } from './types';

/**
 * Converts `hex` to string
 */
export const convertHexToString = (hex: BigNumberish): string => new BigNumber(hex).toFixed();

/**
 * Converts `stringToConvert` to hex number
 */
export const convertStringToHex = (stringToConvert: string): string => new BigNumber(stringToConvert).toString(16);

/**
 * Converts `value` to a number
 */
export const convertStringToNumber = (value: BigNumberish) => new BigNumber(value).toNumber();

/**
 * Converts `value` to a string.
 */
export const convertNumberToString = (value: BigNumberish): string => new BigNumber(value).toFixed();
