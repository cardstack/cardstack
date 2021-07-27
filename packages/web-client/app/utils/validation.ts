import BN from 'bn.js';
import { toWei } from 'web3-utils';

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

interface TokenInputValidationOptions {
  min: BN;
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
    if (!options.max) return '';
    return new BN(toWei(amount)).gt(options.max)
      ? 'Insufficient balance in your account'
      : '';
  },
  (amount: string, options: TokenInputValidationOptions) => {
    return new BN(toWei(amount)).lte(options.min) ? 'Amount is too low' : '';
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
