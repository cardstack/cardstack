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
      return 'Payment attempted at the wrong time'; // Could be the crank's fault. Not much the user can do about it except report it to support
    if (failureReason.includes('ExceedMaxGasPrice'))
      return 'Current gas price exceeds the maximum specified';
    if (failureReason.includes('PaymentExecutionFailed'))
      return 'Funds for transfer and fees are insufficient';
    if (failureReason.includes('OutOfGas'))
      return 'Execution gas is too low to execute the payment'; // Probably our fault where we estimate execution gas. Not much the user can do about it except report it to support
  }

  return 'Unrecognized error';
}

export default helper<Signature>(paymentErrorMessage);
