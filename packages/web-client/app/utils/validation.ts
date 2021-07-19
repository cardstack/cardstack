import BN from 'bn.js';
import { toBN, toWei } from 'web3-utils';

// token input validations that assume string inputs are in wei
function isInvalidAsNumber(amount: string) {
  return isNaN(Number(amount));
}

function failsToCreateBN(amount: string) {
  try {
    toBN(toWei(amount));
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
    return amount.trim().length === 0 ? 'You need to enter an amount' : '';
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
    return toBN(toWei(amount)).gt(options.max) ? 'Amount is too high' : '';
  },
  (amount: string, options: TokenInputValidationOptions) => {
    return toBN(toWei(amount)).lte(options.min) ? 'Amount is too low' : '';
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
