/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ChainAddress, hubRequest, TokenDetail } from '@cardstack/cardpay-sdk';
import config from '@cardstack/safe-tools-client/config/environment';
import HubAuthenticationService from '@cardstack/safe-tools-client/services/hub-authentication';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import SafesService from '@cardstack/safe-tools-client/services/safes';
import TokensService from '@cardstack/safe-tools-client/services/tokens';
import TokenQuantity from '@cardstack/safe-tools-client/utils/token-quantity';
import { action } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { didCancel, task, TaskGenerator } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import DateService from 'ember-date-service/service/date';
import { use, resource } from 'ember-resources';
import { BigNumber } from 'ethers';
import { TrackedObject } from 'tracked-built-ins';

export interface ScheduledPaymentBase {
  id: string;
  feeFixedUSD: string;
  feePercentage: string;
  paymentTokenQuantity: TokenQuantity;
  gasToken: TokenDetail;
  payeeAddress: string;
  privateMemo: string | null;
  payAt: Date;
  chainId: number;
  maxGasPrice: BigNumber;
  isCanceled?: boolean;
  recurringDayOfMonth?: number;
  recurringUntil?: Date;
  nextRetryAttemptAt: Date | null;
  scheduledPaymentAttemptsInLastPaymentCycleCount: number;
  lastScheduledPaymentAttemptId: string;
  retriesLeft: number;
}

export interface ScheduledPayment extends ScheduledPaymentBase {
  executionGasEstimation: string;
  salt: string;
  spHash: string;
  senderSafeAddress: string;
  moduleAddress: string;
  creationTransactionHash?: string;
  creationBlockNumber?: number;
  creationTransactionError?: string;
  cancelationTransactionHash?: string;
  cancelationBlockNumber?: number;
}

export interface ScheduledPaymentAttempt {
  id: string;
  startedAt: Date;
  endedAt: Date;
  status: string;
  failureReason: string;
  executionGasPrice: BigNumber;
  transactionHash?: string;
  scheduledPayment: ScheduledPayment;
}

export interface ScheduledPaymentAttemptResponseItem {
  id: string;
  attributes: {
    'started-at': string;
    'ended-at': string;
    status: string;
    'failure-reason': string;
    'transaction-hash': string;
    'execution-gas-price': string;
  };
  relationships: {
    'scheduled-payment': {
      data: {
        id: string;
      };
    };
  };
}

function buildUnknownToken(tokenAddress: ChainAddress): TokenDetail {
  return {
    address: tokenAddress,
    name: 'Unknown',
    symbol: 'UNKNOWN',
    decimals: 18, // guessing
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
  'max-gas-price': string;
  'canceled-at': string;
  'next-retry-attempt-at': string;
  'scheduled-payment-attempts-in-last-payment-cycle-count': number;
  'recurring-day-of-month': number;
  'recurring-until': string;
  'last-scheduled-payment-attempt-id': string;
  'retries-left': number;
  'private-memo': string | null;
  'sender-safe-address': string;
  'module-address': string;
  'sp-hash': string;
  salt: string;
  'execution-gas-estimation': string;
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
    'next-retry-attempt-at': string;
    'scheduled-payment-attempts-in-last-payment-cycle-count': number;
    'last-scheduled-payment-attempt-id': string;
    'retries-left': number;
    'private-memo': string | null;
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
  @service declare tokens: TokensService;
  @service declare date: DateService;
  @service declare safes: SafesService;

  async fetchScheduledPaymentAttempts(
    chainId: number,
    senderSafeAddress: string,
    status?: ScheduledPaymentAttemptStatus,
    startedAt?: Date
  ): Promise<ScheduledPaymentAttempt[]> {
    let queryString = `filter[chain-id]=${chainId}&filter[sender-safe-address]=${senderSafeAddress}`;
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

  async deserializeScheduledPaymentAttemptResponse(
    response: ScheduledPaymentAttemptResponse
  ): Promise<ScheduledPaymentAttempt[]> {
    return Promise.all(
      response.data.map(async (s) => {
        const scheduledPaymentId = s.relationships['scheduled-payment'].data.id;
        const scheduledPayment = response.included.find(
          (i) => i.id === scheduledPaymentId && i.type === 'scheduled-payments'
        )?.attributes;

        const paymentTokenAddress = scheduledPayment!['token-address'];
        const paymentToken =
          (await this.tokens.tokenFromAddress(paymentTokenAddress)) ||
          buildUnknownToken(paymentTokenAddress);

        const gasTokenAddress = scheduledPayment!['gas-token-address'];
        const gasToken =
          (await this.tokens.tokenFromAddress(gasTokenAddress)) ||
          buildUnknownToken(gasTokenAddress);

        return {
          id: s.id,
          startedAt: new Date(s.attributes['started-at']),
          endedAt: new Date(s.attributes['ended-at']),
          status: s.attributes['status'],
          failureReason: s.attributes['failure-reason'],
          transactionHash: s.attributes['transaction-hash'],
          executionGasPrice: BigNumber.from(
            s.attributes['execution-gas-price']
          ),
          scheduledPayment: {
            id: scheduledPaymentId,
            paymentTokenQuantity: new TokenQuantity(
              paymentToken,
              BigNumber.from(scheduledPayment!.amount)
            ),
            feeFixedUSD: scheduledPayment!['fee-fixed-usd'],
            feePercentage: scheduledPayment!['fee-percentage'],
            gasToken,
            chainId: Number(scheduledPayment!['chain-id']),
            payeeAddress: scheduledPayment!['payee-address'],
            payAt: new Date(scheduledPayment!['pay-at']),
            maxGasPrice: BigNumber.from(scheduledPayment!['max-gas-price']),
            isCanceled: Boolean(scheduledPayment!['canceled-at']),
            nextRetryAttemptAt: scheduledPayment!['next-retry-attempt-at']
              ? new Date(scheduledPayment!['next-retry-attempt-at'])
              : null,
            scheduledPaymentAttemptsInLastPaymentCycleCount: Number(
              scheduledPayment![
                'scheduled-payment-attempts-in-last-payment-cycle-count'
              ]
            ),
            recurringDayOfMonth: scheduledPayment!['recurring-day-of-month'],
            recurringUntil: new Date(scheduledPayment!['recurring-until']),
            lastScheduledPaymentAttemptId:
              scheduledPayment!['last-scheduled-payment-attempt-id'],
            retriesLeft: Number(scheduledPayment!['retries-left']),
            privateMemo: scheduledPayment!['private-memo'],
            executionGasEstimation:
              scheduledPayment!['execution-gas-estimation'],
            salt: scheduledPayment!.salt,
            spHash: scheduledPayment!['sp-hash'],
            senderSafeAddress: scheduledPayment!['sender-safe-address'],
            moduleAddress: scheduledPayment!['module-address'],
          },
        };
      })
    );
  }

  async fetchScheduledPayments(
    chainId: number,
    senderSafeAddress: string,
    minPayAt?: Date
  ): Promise<ScheduledPayment[]> {
    let queryString = `filter[chain-id]=${chainId}&filter[sender-safe-address]=${senderSafeAddress}`;
    if (minPayAt) {
      queryString += `&filter[pay-at][gt]=${new Date().toISOString()}`;
    }
    const response = await hubRequest(
      config.hubUrl,
      `api/scheduled-payments?${queryString}`,
      this.hubAuthentication.authToken!,
      'GET'
    );

    return (await this.deserializeScheduledPaymentResponse(
      response
    )) as ScheduledPayment[];
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

    return (await this.deserializeScheduledPaymentResponse(
      response
    )) as ScheduledPayment;
  }

  @action async reloadScheduledPayments() {
    await this.scheduledPaymentsResource.load();
  }

  @task *loadScheduledPaymentTask(
    chainId: number,
    senderSafeAddress: string
  ): TaskGenerator<ScheduledPayment[]> {
    return yield this.fetchScheduledPayments(
      chainId,
      senderSafeAddress,
      new Date(this.date.now())
    );
  }

  @use scheduledPaymentsResource = resource(() => {
    const senderSafeAddress = this.safes.currentSafe?.address;
    if (!this.hubAuthentication.isAuthenticated || !senderSafeAddress) {
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
            chainId,
            senderSafeAddress
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

  async deserializeScheduledPaymentResponse(
    response: ScheduledPaymentResponse
  ): Promise<ScheduledPayment | ScheduledPayment[]> {
    const deserialize = async (data: ScheduledPaymentResponseItem) => {
      const paymentTokenAddress = data.attributes['token-address'];
      const paymentToken =
        (await this.tokens.tokenFromAddress(paymentTokenAddress)) ||
        buildUnknownToken(paymentTokenAddress);

      const gasTokenAddress = data.attributes!['gas-token-address'];
      const gasToken =
        (await this.tokens.tokenFromAddress(gasTokenAddress)) ||
        buildUnknownToken(gasTokenAddress);
      return {
        id: data.id,
        userAddress: data.attributes['user-address'],
        senderSafeAddress: data.attributes['sender-safe-address'],
        moduleAddress: data.attributes['module-address'],
        paymentTokenQuantity: new TokenQuantity(
          paymentToken,
          BigNumber.from(data.attributes['amount'])
        ),
        feeFixedUSD: data.attributes['fee-fixed-usd'],
        feePercentage: data.attributes['fee-percentage'],
        gasToken,
        chainId: Number(data.attributes['chain-id']),
        payeeAddress: data.attributes['payee-address'],
        privateMemo: data.attributes['private-memo'],
        payAt: new Date(data.attributes['pay-at']),
        executionGasEstimation: data.attributes['execution-gas-estimation'],
        maxGasPrice: BigNumber.from(data.attributes['max-gas-price']),
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
        nextRetryAttemptAt: data.attributes['next-retry-attempt-at']
          ? new Date(data.attributes['next-retry-attempt-at'])
          : null,
        scheduledPaymentAttemptsInLastPaymentCycleCount: Number(
          data.attributes[
            'scheduled-payment-attempts-in-last-payment-cycle-count'
          ]
        ),
        lastScheduledPaymentAttemptId:
          data.attributes['last-scheduled-payment-attempt-id'],
        retriesLeft: Number(data.attributes['retries-left']),
      };
    };

    if (Array.isArray(response.data)) {
      return Promise.all(response.data.map(deserialize));
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
