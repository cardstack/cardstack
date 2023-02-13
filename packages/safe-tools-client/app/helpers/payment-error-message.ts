import { helper } from '@ember/component/helper';

type PositionalArgs = [string];

interface Signature {
  Args: {
    Positional: PositionalArgs;
  };
  Return: string;
}

export function paymentErrorMessage([failureReason]: PositionalArgs) {
  // Try to match the error message to a known error explained in a way that makes sense to the user
  if (failureReason) {
    if (failureReason.includes('InvalidPeriod'))
      return 'payment attempted at the wrong time'; // Could be the crank's fault. Not much the user can do about it except report it to support
    if (failureReason.includes('ExceedMaxGasPrice'))
      return 'current gas price exceeds the maximum specified';
    if (failureReason.includes('PaymentExecutionFailed'))
      return 'insufficient funds to execute the payment'; // This error covers 3 different failure scenarios and it is currently not possible to know which we are dealing with - insufficient funds for either of the: transfer amount, gas fee, service fee
    if (failureReason.includes('OutOfGas'))
      return 'execution gas is too low to execute the payment'; // Probably our fault where we estimate execution gas. Not much the user can do about it except report it to support
  }

  return 'unrecognized error';
}

export default helper<Signature>(paymentErrorMessage);
