import Web3 from 'web3';
import { ScheduledPayment } from '@prisma/client';
import { startCase } from 'lodash';
const { isAddress } = Web3.utils;

type ScheduledPaymentAttribute =
  | 'senderSafeAddress'
  | 'moduleAddress'
  | 'tokenAddress'
  | 'amount'
  | 'payeeAddress'
  | 'executionGasEstimation'
  | 'maxGasPrice'
  | 'feeFixedUsd'
  | 'feePercentage'
  | 'salt'
  | 'payAt'
  | 'recurringDayOfMonth'
  | 'recurringUntil'
  | 'validForDays'
  | 'spHash'
  | 'chainId'
  | 'userAddress';

type ScheduledPaymentErrors = Record<ScheduledPaymentAttribute, string[]>;

export default class ScheduledPaymentValidator {
  validate(scheduledPayment: Partial<ScheduledPayment>): ScheduledPaymentErrors {
    let errors: ScheduledPaymentErrors = {
      senderSafeAddress: [],
      moduleAddress: [],
      tokenAddress: [],
      amount: [],
      payeeAddress: [],
      executionGasEstimation: [],
      maxGasPrice: [],
      feeFixedUsd: [],
      feePercentage: [],
      salt: [],
      payAt: [],
      recurringDayOfMonth: [],
      recurringUntil: [],
      validForDays: [],
      spHash: [],
      userAddress: [],
      chainId: [],
    };

    let mandatoryAttributes: ScheduledPaymentAttribute[] = [
      'senderSafeAddress',
      'moduleAddress',
      'tokenAddress',
      'amount',
      'payeeAddress',
      'executionGasEstimation',
      'maxGasPrice',
      'feeFixedUsd',
      'payAt',
      'feePercentage',
      'salt',
      'spHash',
      'chainId',
      'userAddress',
    ];

    for (let attribute of mandatoryAttributes) {
      if (scheduledPayment[attribute] == null) {
        errors[attribute].push(`${startCase(attribute).toLowerCase()} is required`);
      }
    }

    let addressAttributes: ScheduledPaymentAttribute[] = [
      'senderSafeAddress',
      'moduleAddress',
      'tokenAddress',
      'payeeAddress',
    ];

    for (let attribute of addressAttributes) {
      if (scheduledPayment[attribute] && !isAddress(scheduledPayment[attribute] as string)) {
        errors[attribute].push(`${startCase(attribute).toLowerCase()} is not a valid address`);
      }
    }

    return errors;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'scheduled-payment-validator': ScheduledPaymentValidator;
  }
}
