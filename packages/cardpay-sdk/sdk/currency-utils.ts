/**
 * These functions were pulled from the Rainbow wallet
 * They are specifically for formatting balances and currency, so we are
 * utilizing `bignumber.js` rather than `bn.js` for floating point arithmetic
 */

/**
 * The general failure mode of formatting/conversion functions is returning a NaN.
 */

import BigNumber from 'bignumber.js';
import { get, has, isNil } from 'lodash';
import supportedNativeCurrencies from './native-currencies';

export const isSupportedCurrency = (nativeCurrency: string) => {
  return has(supportedNativeCurrencies, `${nativeCurrency}`);
};

/**
 * Arguments acceptable to a BigNumber constructor, currently equivalent to BigNumber.Value
 */
type BigNumberish = number | string | BigNumber;

/**
 * TBC?:
 * A partial of the interface of base on-chain Asset in https://github.com/cardstack/cardwallet/blob/5b85603d477cd97a41c27ec7786f812afbfa7526/src/entities/tokens.ts#L1
 * Decimals represents the difference between the conventional amount displayed and the amount that the blockchain thinks of it in.
 * Eg. decimals would be 18 for DAI, CARD, and ETH, representing the relationship between ether and wei
 * Necessary for functions to accept arbitrary amounts of decimals as some assets like USDC do not use 18 decimals like many ETH assets do.
 */
interface Asset {
  decimals: number;
  symbol?: string;
}

/**
 * Subtracts numberTwo from numberOne
 *
 * @returns String representation of the number obtained from subtracting numberTwo from numberOne
 */
export const subtract = (numberOne: BigNumberish, numberTwo: BigNumberish): string =>
  new BigNumber(numberOne).minus(new BigNumber(numberTwo)).toFixed();

/**
 * Converts a human-readable amount to an amount friendly for specifying on-chain transactions.
 *
 * @param value - BigNumberish
 * @param decimals - The number of decimals the asset has
 */
export const convertAmountToRawAmount = (value: BigNumberish, decimals: number | string): string =>
  new BigNumber(value).times(new BigNumber(10).pow(decimals)).toFixed();

/**
 * Checks whether `value` is zero or not
 */
export const isZero = (value: BigNumberish): boolean => new BigNumber(value).isZero();

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
 * Converts `value` to a string. Can return `NaN`.
 */
export const convertNumberToString = (value: BigNumberish): string => new BigNumber(value).toFixed();

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
 * Counts the value's number of decimals places
 * Returns null for Infinity or NaN
 *
 * @param  {String} value
 */
export const countDecimalPlaces = (value: BigNumberish): number => new BigNumber(value).dp();

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

/**
 * Converts hex number to string
 */
export const convertHexToString = (hex: BigNumberish): string => new BigNumber(hex).toFixed();

/**
 * Converts numeric string to hex number
 */
export const convertStringToHex = (stringToConvert: string): string => new BigNumber(stringToConvert).toString(16);

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
 * Calculates `numberOne * buffer`, rounded to an integer
 *
 * @param numberOne - BigNumberish
 * @param buffer - BigNumberish
 */
export const addBuffer = (numberOne: BigNumberish, buffer: BigNumberish = '1.2'): string =>
  new BigNumber(numberOne).times(buffer).toFixed(0);

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
 * Converts a string to a number
 */
export const convertStringToNumber = (value: BigNumberish) => new BigNumber(value).toNumber();

/**
 * Checks if `numberOne` is less than `numberTwo`
 */
export const lessThan = (numberOne: BigNumberish, numberTwo: BigNumberish): boolean =>
  new BigNumber(numberOne).lt(numberTwo);

/**
 * If `handleSignificantDecimals(value, decimals, buffer)` returns a value greater than the threshold,
 * returns the value. Otherwise returns `< ${threshold}`.
 *
 * @see handleSignificantDecimals
 */
export const handleSignificantDecimalsWithThreshold = (
  value: BigNumberish,
  decimals: number,
  buffer = 3,
  threshold = '0.0001'
) => {
  const result = handleSignificantDecimals(value, decimals, buffer);
  return lessThan(result, threshold) ? `< ${threshold}` : result;
};

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
 * This is basically multiply, but more intent-revealing when used in the wallet?
 * @see multiply
 */
export const convertAmountToNativeAmount = (amount: BigNumberish, priceUnit: BigNumberish): string =>
  multiply(amount, priceUnit);

/**
 * Returns a balance object with properties `balanceObject.amount` and `balanceObject.display`
 *
 * `balanceObject.amount` is `amount * priceUnit`.
 * `balanceObject.display` is a formatted version of `balanceObject.amount` based on the native currency specified.
 *
 * @see convertAmountToNativeDisplay
 */
export const convertAmountAndPriceToNativeDisplay = (
  amount: BigNumberish,
  priceUnit: BigNumberish,
  nativeCurrency: string,
  buffer?: number
): { amount: string; display: string } => {
  const nativeBalanceRaw = convertAmountToNativeAmount(amount, priceUnit);
  const nativeDisplay = convertAmountToNativeDisplay(nativeBalanceRaw, nativeCurrency, buffer);
  return {
    amount: nativeBalanceRaw,
    display: nativeDisplay,
  };
};

/**
 * Divides `rawAmount` by `assetDecimals` and then calls `convertAmountAndPriceToNativeDisplay`
 */
export const convertRawAmountToNativeDisplay = (
  rawAmount: BigNumberish,
  assetDecimals: number,
  priceUnit: BigNumberish,
  nativeCurrency: string,
  buffer?: number
) => {
  const assetBalance = convertRawAmountToDecimalFormat(rawAmount, assetDecimals);
  return convertAmountAndPriceToNativeDisplay(assetBalance, priceUnit, nativeCurrency, buffer);
};

/**
 * Returns a balance object with properties `balanceObject.amount` and `balanceObject.display`
 *
 * `balanceObject.amount` is `value / 10**asset.decimals`
 * `balanceObject.display` is `balanceObject.amount` with `asset.symbol` tacked on, if present
 */
export const convertRawAmountToBalance = (value: BigNumberish, asset: Asset, buffer?: number) => {
  const decimals = get(asset, 'decimals', 18);
  const assetBalance = convertRawAmountToDecimalFormat(value, decimals);

  return {
    amount: assetBalance,
    display: convertAmountToBalanceDisplay(assetBalance, asset, buffer),
  };
};

/**
 * Passes `value`, `asset.decimals`, and `buffer` to `handleSignificantDecimals` and then tacks on `asset.symbol` at the end of the returned value
 */
export const convertAmountToBalanceDisplay = (value: BigNumberish, asset: Asset, buffer?: number) => {
  const decimals = get(asset, 'decimals', 18);
  const display = handleSignificantDecimals(value, decimals, buffer);
  return `${display} ${get(asset, 'symbol', '')}`;
};

/**
 * Passes its arguments to `handleSignificantDecimals` and then tacks on % at the end of the returned value
 */
export const convertAmountToPercentageDisplay = (value: BigNumberish, decimals = 2, buffer?: number): string => {
  const display = handleSignificantDecimals(value, decimals, buffer);
  return `${display}%`;
};

/**
 * Divides `value` by 100 and rounds to specified `decimals`
 */
export const convertBipsToPercentage = (value: BigNumberish, decimals = 2): string =>
  new BigNumber(value).shiftedBy(-2).toFixed(decimals);

/**
 * Returns a formatted string given a `value`, `currency`, and `buffer`. `buffer` defaults to 3,
 * based on `handleSignificantDecimals`.
 *
 * Calculation of the amount in the formatted string is as follows.
 * If `value` is between -1 and 1, the amount is `value` rounded to one of the
 * following decimal places (whichever is smaller), then formatted to a minimum of 2 decimal places:
 * - 8
 * - number of decimal places to reach `value`'s first significant digit + `buffer`.
 *   Buffer basically acts as the number of significant digits to show
 *
 * Otherwise the amount is `value` rounded to the smaller of the specified currency's decimals and `buffer`,
 * formatted with at least 2 decimal places.
 *
 * ```
 * convertAmountToNativeDisplay(1.112, 'USD', 1) // $1.10 USD - the buffer is smaller than the 2 decimal places specified by USD
 * convertAmountToNativeDisplay(1.112, 'USD', 3) // '$1.11 USD' - USD specifies 2 decimal places
 * ```
 *
 * @see handleSignificantDecimals for more details on calculating amount
 */
export const convertAmountToNativeDisplay = (value: BigNumberish, nativeCurrency: string, buffer?: number) => {
  const nativeSelected = get(supportedNativeCurrencies, `${nativeCurrency}`);

  if (!nativeSelected) {
    throw new Error(`Unknown currency ${nativeCurrency}`);
  }

  const { decimals } = nativeSelected;
  const display = handleSignificantDecimals(value, decimals, buffer);
  if (nativeSelected.alignment === 'left') {
    return `${nativeSelected.symbol}${display} ${nativeSelected.currency}`;
  }
  return `${display} ${nativeSelected.symbol} ${nativeSelected.currency}`;
};

/**
 * Converts blockchain-friendly values to values conventionally shown to users by dividing by the specified number of `decimals`
 */
export const convertRawAmountToDecimalFormat = (value: BigNumberish, decimals = 18): string =>
  new BigNumber(value).dividedBy(new BigNumber(10).pow(decimals)).toFixed();

/**
 * Converts wei to ether (divide by 10**18)
 */
export const fromWei = (number: BigNumberish): string => convertRawAmountToDecimalFormat(number, 18);

/**
 * Returns a promise that resolves after `ms` milliseconds
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

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

/**
 * Formats `amount` with specified amount of decimal places (and default BigNumber formatting)
 */
export const formatCurrencyAmount = (amount: BigNumberish, decimalPlaces = 2) => {
  return new BigNumber(amount).toFormat(decimalPlaces);
};
