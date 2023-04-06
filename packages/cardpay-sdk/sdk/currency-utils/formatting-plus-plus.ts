/**
 * This file contains functions that perform composite operations or operations that don't fit in anywhere else.
 * Most of these functions perform some form of formatting.
 *
 * Understanding how {@link handleSignificantDecimals} works will be helpful in understanding many of these utilities.
 */

import BigNumber from 'bignumber.js';
import { get, has } from 'lodash';
import { convertAmountToNativeAmount, convertRawAmountToDecimalFormat } from './amount-conversion';
import { lessThan } from './comparison';
import { currencies } from '../currencies';
import { handleSignificantDecimals } from './rounding-and-approximation';
import { BigNumberish } from './types';

/**
 * @group Utils
 * @category Currency
 */
export const isSupportedCurrency = (nativeCurrency: string) => {
  return has(currencies, `${nativeCurrency}`);
};

/**
 * A partial of the interface of base on-chain Asset in https://github.com/cardstack/cardwallet/blob/5b85603d477cd97a41c27ec7786f812afbfa7526/src/entities/tokens.ts#L1
 * Decimals represents the difference between the conventional amount displayed and the amount that the blockchain thinks of it in.
 * Eg. decimals would be 18 for DAI, CARD, and ETH, representing the relationship between ether and wei
 * Necessary for functions to accept arbitrary amounts of decimals as some assets like USDC do not use 18 decimals like many ETH assets do.
 * @group Utils
 * @category Currency
 */
export interface Asset {
  decimals: number;
  symbol?: string;
}

/**
 * Counts the number of decimals places in `value`
 * Returns null for Infinity or NaN
 * @group Utils
 * @category Currency
 */
export const countDecimalPlaces = (value: BigNumberish): number => new BigNumber(value).dp();

/**
 * If `handleSignificantDecimals(value, decimals, buffer)` returns a value greater than the threshold,
 * returns the value. Otherwise returns `< ${threshold}`.
 *
 * @see {@link handleSignificantDecimals}
 * @group Utils
 * @category Currency
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
 * Returns a balance object with properties `balanceObject.amount` and `balanceObject.display`
 *
 * - `balanceObject.amount` is `amount * priceUnit`.
 * - `balanceObject.display` is a formatted version of `balanceObject.amount` based on the native currency specified.
 * `buffer` can be used to control the amount of decimal places shown.
 * For more details on how this property is generated see {@link convertAmountToNativeDisplay}.
 * @group Utils
 * @category Currency
 *
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
 * Calculates `rawAmount / 10**assetDecimals` and then returns `convertAmountAndPriceToNativeDisplay(amount, priceUnit, nativeCurrency, buffer)`
 * @group Utils
 * @category Currency
 * @see {@link convertAmountAndPriceToNativeDisplay}.
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
 * - `balanceObject.amount` is `value / 10**asset.decimals`
 * - `balanceObject.display` - `convertAmountToBalanceDisplay(balanceObject.amount, asset, buffer)`
 *
 * @group Utils
 * @category Currency
 * @see {@link convertAmountToBalanceDisplay}
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
 * @group Utils
 * @category Currency
 */
export const convertAmountToBalanceDisplay = (value: BigNumberish, asset: Asset, buffer?: number) => {
  const decimals = get(asset, 'decimals', 18);
  const display = handleSignificantDecimals(value, decimals, buffer);
  return `${display} ${get(asset, 'symbol', '')}`;
};

/**
 * Passes its arguments to `handleSignificantDecimals` and then tacks on % at the end of the returned value
 *
 * @see {@link handleSignificantDecimals}
 * @group Utils
 * @category Currency
 */
export const convertAmountToPercentageDisplay = (value: BigNumberish, decimals = 2, buffer?: number): string => {
  const display = handleSignificantDecimals(value, decimals, buffer);
  return `${display}%`;
};

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
 * @group Utils
 * @category Currency
 * @example
 * ```ts
 * convertAmountToNativeDisplay(1.112, 'USD', 1) // $1.10 USD - the buffer is smaller than the 2 decimal places specified by USD
 * convertAmountToNativeDisplay(1.112, 'USD', 3) // '$1.11 USD' - USD specifies 2 decimal places
 * ```
 *
 * @see {@link handleSignificantDecimals} for more details on calculating amount
 */
export const convertAmountToNativeDisplay = (value: BigNumberish, nativeCurrency: string, buffer?: number) => {
  const nativeSelected = get(currencies, `${nativeCurrency}`);

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
 * Formats `amount` with specified amount of decimal places (and default BigNumber formatting)
 * @group Utils
 * @category Currency
 */
export const formatCurrencyAmount = (amount: BigNumberish, decimalPlaces = 2) => {
  return new BigNumber(amount).toFormat(decimalPlaces);
};

/**
 * Returns a promise that resolves after `ms` milliseconds
 * @group Utils
 * @category Currency
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
