import BN from 'bn.js';
import { fromWei, toWei } from 'web3-utils';
import { TokenSymbol } from '@cardstack/ssr-web/utils/token';
import { convertRawAmountToNativeDisplay } from '@cardstack/cardpay-sdk';

// token input validations that assume string inputs are in ether
function isInvalidAsNumber(amount: string) {
  return isNaN(Number(amount));
}

function failsToCreateBN(amount: string) {
  try {
    new BN(toWei(amount));
  } catch (e) {
    return true;
  }
  return false;
}

function formatAmount(amount: BN, token: TokenSymbol) {
  let tokenForFormatter = token;
  let tokenIsBridged = token.endsWith('.CPXD');

  // Bridged currencies aren’t recognised
  if (tokenIsBridged) {
    tokenForFormatter = token.replace(/\.CPXD$/, '') as TokenSymbol;
  }

  let formattedString = convertRawAmountToNativeDisplay(
    fromWei(amount.toString()),
    0,
    1,
    tokenForFormatter
  ).display;

  // Replace the unbridged symbol with the bridged one
  if (tokenIsBridged) {
    formattedString = formattedString.replace(tokenForFormatter, token);
  }

  return formattedString;
}

export interface TokenInputValidationOptions {
  tokenSymbol: TokenSymbol;
  min?: BN;
  balance?: BN;
  max?: BN;
}

let orderedTokenInputValidations: Array<
  | ((amount: string, options: TokenInputValidationOptions) => string)
  | ((amount: string) => string)
> = [
  (amount: string) => {
    return amount.trim().length === 0 ? 'This field is required' : '';
  },
  (amount: string) => {
    return isInvalidAsNumber(amount) ? 'Amount must be a valid number' : '';
  },
  (amount: string) => {
    const regex = /^\d*(\.\d{0,18})?$/;
    return !regex.test(amount)
      ? 'Amount must have less than 18 decimal points'
      : '';
  },
  (amount: string) => {
    return failsToCreateBN(amount) ? 'Amount must be a valid number' : '';
  },
  (amount: string, options: TokenInputValidationOptions) => {
    if (!options.balance) return '';
    return new BN(toWei(amount)).gt(options.balance)
      ? 'Insufficient balance in your account'
      : '';
  },
  (amount: string, options: TokenInputValidationOptions) => {
    if (!options.max) return '';
    return new BN(toWei(amount)).gt(options.max)
      ? `Amount must be below ${formatAmount(options.max, options.tokenSymbol)}`
      : '';
  },
  (amount: string, options: TokenInputValidationOptions) => {
    if (options.min) return '';
    let zero = new BN(0);
    return new BN(toWei(amount)).lte(zero)
      ? `Amount must be above ${formatAmount(new BN(0), options.tokenSymbol)}`
      : '';
  },
  (amount: string, options: TokenInputValidationOptions) => {
    if (!options.min) return '';
    return new BN(toWei(amount)).lt(options.min)
      ? `Amount must be at least ${formatAmount(
          options.min,
          options.tokenSymbol
        )}`
      : '';
  },
];

export function validateTokenInput(
  amount: string,
  options: TokenInputValidationOptions
) {
  for (let validation of orderedTokenInputValidations) {
    let error = validation(amount, options);
    if (error) {
      return error;
    }
  }
  return '';
}

export function shouldUseTokenInput(newAmount: string) {
  return !isInvalidAsNumber(newAmount);
}
