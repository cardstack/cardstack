import Web3 from 'web3';
import { ScheduledPayment } from '@prisma/client';
import { startCase } from 'lodash';
import { convertChainIdToName, isSupportedChain, SchedulerCapableNetworks } from '@cardstack/cardpay-sdk';
import { inject } from '@cardstack/di';
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
  | 'userAddress'
  | 'gasTokenAddress';

type ScheduledPaymentErrors = Record<ScheduledPaymentAttribute, string[]>;

export default class ScheduledPaymentValidator {
  cardpay = inject('cardpay');

  async validate(scheduledPayment: Partial<ScheduledPayment>): Promise<ScheduledPaymentErrors> {
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
      gasTokenAddress: [],
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
      'gasTokenAddress',
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

    if (scheduledPayment.chainId) {
      if (!isSupportedChain(scheduledPayment.chainId)) {
        errors.chainId.push(`chain is not supported`);
      } else {
        const networkName = convertChainIdToName(scheduledPayment.chainId) as SchedulerCapableNetworks;

        let feeFixedUSD = this.cardpay.getConstantByNetwork('scheduledPaymentFeeFixedUSD', networkName) ?? 0;
        if (Number(scheduledPayment.feeFixedUsd) < feeFixedUSD) {
          errors.feeFixedUsd.push(`fee USD must be greater than or equal ${feeFixedUSD}`);
        }

        let feePercentage = this.cardpay.getConstantByNetwork('scheduledPaymentFeePercentage', networkName) ?? 0;
        if (Number(scheduledPayment.feePercentage) < feePercentage) {
          errors.feePercentage.push(`fee percentage must be greater than or equal ${feePercentage}`);
        }

        let supportedGasTokens = await this.cardpay.fetchSupportedGasTokens(scheduledPayment.chainId);
        if (
          !supportedGasTokens.find(
            (supportedGasToken) => supportedGasToken.address === scheduledPayment.gasTokenAddress
          )
        ) {
          errors.gasTokenAddress.push(
            `gas token is not supported, supported gas token: ${supportedGasTokens.map((sp) => sp.address).join(', ')}`
          );
        }
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
