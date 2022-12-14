/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { hubRequest } from '@cardstack/cardpay-sdk';
import HubAuthenticationService from '@cardstack/safe-tools-client/services/hub-authentication';
import Service, { inject as service } from '@ember/service';

export interface ScheduledPaymentAttempt {
  startedAt: Date;
  endedAt: Date;
  status: string;
  failureReason: string;
  transactionHash: string;
  scheduledPayment: {
    amount: string;
    feeFixedUSD: string;
    feePercentage: string;
    tokenAddress: string;
    gasTokenAddress: string;
    payeeAddress: string;
    payAt: string;
    chainId: string;
  };
}

export interface ScheduledPaymentResponseItem {
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

export interface ScheduledPaymentData {
  amount: string;
  'fee-fixed-usd': string;
  'fee-percentage': string;
  'token-address': string;
  'gas-token-address': string;
  'payee-address': string;
  'pay-at': string;
  'chain-id': string;
}

export interface ScheduledPaymentResponseIncludedItem {
  id: string;
  type: string;
  attributes: ScheduledPaymentData;
}

export interface ScheduledPaymentResponse {
  data: ScheduledPaymentResponseItem[];
  included: ScheduledPaymentResponseIncludedItem[];
}

export default class ScheduledPaymentsService extends Service {
  @service declare hubAuthentication: HubAuthenticationService;

  async fetchScheduledPaymentAttempts(
    chainId: number
  ): Promise<ScheduledPaymentAttempt[]> {
    await this.hubAuthentication.ensureAuthenticated();

    const response = await hubRequest(
      this.hubAuthentication.hubUrl,
      `api/scheduled-payment-attempts?filter[chain-id]=${chainId}`,
      this.hubAuthentication.authToken!,
      'GET'
    );

    return this.deserializeScheduledPaymentResponse(response);
  }

  deserializeScheduledPaymentResponse(
    response: ScheduledPaymentResponse
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
          amount: scheduledPayment!.amount,
          feeFixedUSD: scheduledPayment!['fee-fixed-usd'],
          feePercentage: scheduledPayment!['fee-percentage'],
          gasTokenAddress: scheduledPayment!['gas-token-address'],
          tokenAddress: scheduledPayment!['token-address'],
          chainId: scheduledPayment!['chain-id'],
          payeeAddress: scheduledPayment!['payee-address'],
          payAt: scheduledPayment!['pay-at'],
        },
      };
    });
  }
}
