/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { hubRequest } from '@cardstack/cardpay-sdk';
import config from '@cardstack/safe-tools-client/config/environment';
import HubAuthenticationService from '@cardstack/safe-tools-client/services/hub-authentication';
import Service, { inject as service } from '@ember/service';
import { BigNumber } from 'ethers';

export interface ScheduledPayment {
  id: string;
  amount: BigNumber;
  feeFixedUSD: string;
  feePercentage: string;
  tokenAddress: string;
  gasTokenAddress: string;
  payeeAddress: string;
  payAt: Date;
  chainId: number;
  executionGasEstimation: string;
  maxGasPrice: string;
  salt: string;
  spHash: string;
  senderSafeAddress: string;
  moduleAddress: string;
  recurringDayOfMonth?: number;
  recurringUntil?: Date;
  creationTransactionHash?: string;
  creationBlockNumber?: number;
  creationTransactionError?: string;
  cancelationTransactionHash?: string;
  cancelationBlockNumber?: number;
}

export interface ScheduledPaymentAttempt {
  startedAt: Date;
  endedAt: Date;
  status: string;
  failureReason: string;
  transactionHash: string;
  scheduledPayment: {
    amount: BigNumber;
    feeFixedUSD: string;
    feePercentage: string;
    tokenAddress: string;
    gasTokenAddress: string;
    payeeAddress: string;
    payAt: Date;
    chainId: number;
  };
}

export interface ScheduledPaymentAttemptResponseItem {
  attributes: {
    id: string;
    'started-at': string;
    'ended-at': string;
    status: string;
    'failure-reason': string;
    'transaction-hash': string;
  };
  relationships: {
    'scheduled-payment': {
      data: {
        id: string;
      };
    };
  };
}

export interface ScheduledPaymentAttemptIncludedData {
  amount: string;
  'fee-fixed-usd': string;
  'fee-percentage': string;
  'token-address': string;
  'gas-token-address': string;
  'payee-address': string;
  'pay-at': string;
  'chain-id': string;
}

export interface ScheduledPaymentAttemptResponseIncludedItem {
  id: string;
  type: string;
  attributes: ScheduledPaymentAttemptIncludedData;
}

export interface ScheduledPaymentAttemptResponse {
  data: ScheduledPaymentAttemptResponseItem[];
  included: ScheduledPaymentAttemptResponseIncludedItem[];
}

export type ScheduledPaymentAttemptStatus =
  | 'succeeded'
  | 'failed'
  | 'inProgress';

export interface ScheduledPaymentResponseItem {
  id: string;
  attributes: {
    'user-address': string;
    'sender-safe-address': string;
    'module-address': string;
    'token-address': string;
    'gas-token-address': string;
    amount: string;
    'payee-address': string;
    'execution-gas-estimation': string;
    'max-gas-price': string;
    'fee-fixed-usd': string;
    'fee-percentage': string;
    salt: string;
    'pay-at': string;
    'sp-hash': string;
    'chain-id': string;
    'recurring-day-of-month': string;
    'recurring-until': string;
    'creation-transaction-hash': string;
    'creation-block-number': string;
    'creation-transaction-error': string;
    'cancelation-transaction-hash': string;
    'cancelation-block-number': string;
  };
}

export interface ScheduledPaymentResponse {
  data: ScheduledPaymentResponseItem[];
}

export default class ScheduledPaymentsService extends Service {
  @service declare hubAuthentication: HubAuthenticationService;

  async fetchScheduledPaymentAttempts(
    chainId: number,
    status?: ScheduledPaymentAttemptStatus,
    startedAt?: Date
  ): Promise<ScheduledPaymentAttempt[]> {
    let queryString = `filter[chain-id]=${chainId}`;
    if (status) {
      queryString += `&filter[status]=${status}`;
    }
    if (startedAt) {
      queryString += `&filter[started-at][gt]=${Math.round(
        startedAt.getTime() / 1000
      )}`;
    }
    const response = await hubRequest(
      config.hubUrl,
      `api/scheduled-payment-attempts?${queryString}`,
      this.hubAuthentication.authToken!,
      'GET'
    );

    return this.deserializeScheduledPaymentAttemptResponse(response);
  }

  deserializeScheduledPaymentAttemptResponse(
    response: ScheduledPaymentAttemptResponse
  ): ScheduledPaymentAttempt[] {
    return response.data.map((s) => {
      const scheduledPaymentId = s.relationships['scheduled-payment'].data.id;
      const scheduledPayment = response.included.find(
        (i) => i.id === scheduledPaymentId && i.type === 'scheduled-payments'
      )?.attributes;
      return {
        startedAt: new Date(s.attributes['started-at']),
        endedAt: new Date(s.attributes['ended-at']),
        status: s.attributes['status'],
        failureReason: s.attributes['failure-reason'],
        transactionHash: s.attributes['transaction-hash'],
        scheduledPayment: {
          amount: BigNumber.from(scheduledPayment!.amount),
          feeFixedUSD: scheduledPayment!['fee-fixed-usd'],
          feePercentage: scheduledPayment!['fee-percentage'],
          gasTokenAddress: scheduledPayment!['gas-token-address'],
          tokenAddress: scheduledPayment!['token-address'],
          chainId: Number(scheduledPayment!['chain-id']),
          payeeAddress: scheduledPayment!['payee-address'],
          payAt: new Date(scheduledPayment!['pay-at']),
        },
      };
    });
  }

  async fetchScheduledPayments(
    chainId: number,
    minPayAt?: Date
  ): Promise<ScheduledPayment[]> {
    let queryString = `filter[chain-id]=${chainId}`;
    if (minPayAt) {
      queryString += `&filter[payAt][gt]=${Math.round(
        minPayAt.getTime() / 1000
      )}`;
    }
    const response = await hubRequest(
      config.hubUrl,
      `api/scheduled-payments?${queryString}`,
      this.hubAuthentication.authToken!,
      'GET'
    );

    return this.deserializeScheduledPaymentResponse(response);
  }

  deserializeScheduledPaymentResponse(
    response: ScheduledPaymentResponse
  ): ScheduledPayment[] {
    return response.data.map((s) => {
      return {
        id: s.id,
        userAddress: s.attributes['user-address'],
        senderSafeAddress: s.attributes['sender-safe-address'],
        moduleAddress: s.attributes['module-address'],
        amount: BigNumber.from(s.attributes.amount),
        feeFixedUSD: s.attributes['fee-fixed-usd'],
        feePercentage: s.attributes['fee-percentage'],
        gasTokenAddress: s.attributes['gas-token-address'],
        tokenAddress: s.attributes['token-address'],
        chainId: Number(s.attributes['chain-id']),
        payeeAddress: s.attributes['payee-address'],
        payAt: new Date(s.attributes['pay-at']),
        executionGasEstimation: s.attributes['execution-gas-estimation'],
        maxGasPrice: s.attributes['max-gas-price'],
        salt: s.attributes['salt'],
        spHash: s.attributes['sp-hash'],
        recurringDayOfMonth: Number(s.attributes['recurring-day-of-month']),
        recurringUntil: new Date(s.attributes['recurring-until']),
        creationTransactionHash: s.attributes['creation-transaction-hash'],
        creationBlockNumber: Number(s.attributes['creation-block-number']),
        creationTransactionError: s.attributes['creation-transaction-error'],
        cancelationTransactionHash:
          s.attributes['cancelation-transaction-hash'],
        cancelationBlockNumber: Number(
          s.attributes['cancelation-block-number']
        ),
      };
    });
  }
}
