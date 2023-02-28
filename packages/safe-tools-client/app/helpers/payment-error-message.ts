import { nativeUnitsToDecimal } from '@cardstack/safe-tools-client/helpers/native-units-to-decimal';
import { helper } from '@ember/component/helper';
import { BigNumber } from 'ethers';

type PositionalArgs = [string, BigNumber?, number?];

interface Signature {
  Args: {
    Positional: PositionalArgs;
  };
  Return: string;
}

export function paymentErrorMessage([
  failureReason,
  executionGasPrice,
  decimals,
]: PositionalArgs) {
  const executionGasPriceInBiggestUnit =
    executionGasPrice && decimals
      ? nativeUnitsToDecimal([executionGasPrice, decimals, 3])
      : undefined;

  // Try to match the error message to a known error explained in a way that makes sense to the user
  if (failureReason) {
    if (failureReason.includes('InvalidPeriod'))
      // The crank attempted this payment at the time that the scheduled payment module smart contract did not agree with.
      // This is indicative of a scheduling bug in the crank or in the contract.
      // The user can't do anything to fix it but report it to support.
      return 'attempted at the incorrect time - contact support';
    if (failureReason.includes('ExceedMaxGasPrice'))
      return executionGasPriceInBiggestUnit
        ? `gas price exceeded the maximum specified, execution gas price: ${executionGasPriceInBiggestUnit}`
        : 'gas price exceeded the maximum specified';
    if (failureReason.includes('PaymentExecutionFailed'))
      // This error covers 3 different failure scenarios and it is currently not possible to know which we are
      // dealing with. It means insufficient funds for either of the: transfer amount, gas fee, service fee
      return 'insufficient funds to execute the payment';
    if (failureReason.includes('OutOfGas'))
      // There is something wrong with our payment execution gas estimation. This is indicative of a bug in the smart contract or the SDK.
      // The user can't do anything to fix it but report it to support.
      return 'incorrect gas estimation - contact support';
  }

  return 'unknown error - contact support';
}

export default helper<Signature>(paymentErrorMessage);
