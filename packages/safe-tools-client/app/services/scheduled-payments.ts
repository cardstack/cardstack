/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { hubRequest } from '@cardstack/cardpay-sdk';
import config from '@cardstack/safe-tools-client/config/environment';
import HubAuthenticationService from '@cardstack/safe-tools-client/services/hub-authentication';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import { action } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { didCancel, task, TaskGenerator } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import DateService from 'ember-date-service/service/date';
import { use, resource } from 'ember-resources';
import { BigNumber } from 'ethers';
import { TrackedObject } from 'tracked-built-ins';

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

interface ScheduledPaymentsResourceState extends Record<PropertyKey, unknown> {
  error?: Error;
  isLoading?: boolean;
  value?: ScheduledPayment[];
  load: () => Promise<void>;
}

export default class ScheduledPaymentsService extends Service {
  @service declare hubAuthentication: HubAuthenticationService;
  @service declare network: NetworkService;
  @service declare date: DateService;

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

    return this.deserializeScheduledPaymentResponse(
      response
    ) as ScheduledPayment[];
  }

  async fetchScheduledPayment(
    scheduledPaymentId: number
  ): Promise<ScheduledPayment> {
    const response = await hubRequest(
      config.hubUrl,
      `api/scheduled-payments/${scheduledPaymentId}`,
      this.hubAuthentication.authToken!,
      'GET'
    );

    return this.deserializeScheduledPaymentResponse(
      response
    ) as ScheduledPayment;
  }

  @action async reloadScheduledPayments() {
    await this.scheduledPaymentsResource.load();
  }

  @task *loadScheduledPaymentTask(
    chainId: number
  ): TaskGenerator<ScheduledPayment[]> {
    return yield this.fetchScheduledPayments(
      chainId,
      new Date(this.date.now())
    );
  }

  @use scheduledPaymentsResource = resource(() => {
    if (!this.hubAuthentication.isAuthenticated) {
      return {
        error: false,
        isLoading: false,
        value: [],
        load: () => Promise.resolve(),
      };
    }

    const chainId = this.network.chainId;

    const state: ScheduledPaymentsResourceState = new TrackedObject({
      isLoading: true,
      value: undefined as ScheduledPayment[] | undefined,
      error: undefined,
      load: async () => {
        state.isLoading = true;

        try {
          state.value = await taskFor(this.loadScheduledPaymentTask).perform(
            chainId
          );
        } catch (error) {
          if (!didCancel(error)) {
            state.error = error;
            throw error;
          }
        } finally {
          state.isLoading = false;
        }
      },
    });

    state.load();
    return state;
  });

  deserializeScheduledPaymentResponse(
    response: ScheduledPaymentResponse
  ): ScheduledPayment | ScheduledPayment[] {
    const deserialize = (data: ScheduledPaymentResponseItem) => {
      return {
        id: data.id,
        userAddress: data.attributes['user-address'],
        senderSafeAddress: data.attributes['sender-safe-address'],
        moduleAddress: data.attributes['module-address'],
        amount: BigNumber.from(data.attributes.amount),
        feeFixedUSD: data.attributes['fee-fixed-usd'],
        feePercentage: data.attributes['fee-percentage'],
        gasTokenAddress: data.attributes['gas-token-address'],
        tokenAddress: data.attributes['token-address'],
        chainId: Number(data.attributes['chain-id']),
        payeeAddress: data.attributes['payee-address'],
        payAt: new Date(data.attributes['pay-at']),
        executionGasEstimation: data.attributes['execution-gas-estimation'],
        maxGasPrice: data.attributes['max-gas-price'],
        salt: data.attributes['salt'],
        spHash: data.attributes['sp-hash'],
        recurringDayOfMonth: Number(data.attributes['recurring-day-of-month']),
        recurringUntil: new Date(data.attributes['recurring-until']),
        creationTransactionHash: data.attributes['creation-transaction-hash'],
        creationBlockNumber: Number(data.attributes['creation-block-number']),
        creationTransactionError: data.attributes['creation-transaction-error'],
        cancelationTransactionHash:
          data.attributes['cancelation-transaction-hash'],
        cancelationBlockNumber: Number(
          data.attributes['cancelation-block-number']
        ),
      };
    };

    if (Array.isArray(response.data)) {
      return response.data.map(deserialize);
    } else {
      return deserialize(response.data);
    }
  }
}

declare module '@ember/service' {
  interface Registry {
    'scheduled-payments': ScheduledPaymentsService;
  }
}
