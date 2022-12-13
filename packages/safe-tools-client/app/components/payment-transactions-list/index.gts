import { getSDK, Web3Provider } from '@cardstack/cardpay-sdk';
import Component from '@glimmer/component';
import { hubRequest } from '@cardstack/cardpay-sdk';
import './index.css';
import { use, resource } from 'ember-resources';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import HubAuthenticationService from '@cardstack/safe-tools-client/services/hub-authentication';
import Service, { inject as service } from '@ember/service';
import { TrackedObject } from 'tracked-built-ins';
import eq from 'ember-truth-helpers/helpers/eq';
import formatDate from '@cardstack/safe-tools-client/helpers/format-date';

interface ScheduledPaymentAttempt {
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
  }
}


class PaymentTransactionsList extends Component {
  @service declare wallet: WalletService;
  @service declare hubAuthentication: HubAuthenticationService;


  deserializeScheduledPaymentResponse(response: unknown): ScheduledPaymentAttempt[] {
    return response.data.map(s => {
      let scheduledPaymentId = s.relationships['scheduled-payment'].data.id;
      let scheduledPayment = response.included.find(i => i.id === scheduledPaymentId && i.type === 'scheduled-payments').attributes;
      return {
        startedAt: new Date(s.attributes['started-at']),
        endedAt: new Date(s.attributes['ended-at']),
        status: s.attributes['status'],
        failureReason: s.attributes['failure-reason'],
        transactionHash: s.attributes['transaction-hash'],
        scheduledPayment: {
          amount: scheduledPayment.amount,
          feeFixedUSD: scheduledPayment['fee-fixed-usd'],
          feePercentage: scheduledPayment['fee-percentage'],
          gasTokenAddress: scheduledPayment['gas-token-address'],
          tokenAddress: scheduledPayment['token-address'],
          chainId: scheduledPayment['chain-id'],
          payeeAddress: scheduledPayment['payee-address'],
        }
      };
    })
  }

  @use scheduledPaymentAttemptsResource = resource(() => {
    if (!this.wallet.isConnected) {
      return {
        error: false,
        isLoading: false,
        value: [],
      };
    }

    const state = new TrackedObject({
      isLoading: false,
      value: undefined as ScheduledPaymentAttempt[] | undefined,
      error: undefined,
    });

    (async () => {
      try {
        await this.hubAuthentication.ensureAuthenticated();
        let response = await hubRequest(this.hubAuthentication.hubUrl, `api/scheduled-payment-attempts`, this.hubAuthentication.authToken!, 'GET');
        state.value = this.deserializeScheduledPaymentResponse(response);
      } catch (error) {
        console.log(error);
        state.error = error;
      } finally {
        state.isLoading = false;
      }
    })();

    return state;
  });

  <template>
    <div class="table__wrap">
      <table class="table">
        <thead class="table__header">
          <tr class="table__row">
            <th class="table__cell">Time</th>
            <th class="table__cell">Date</th>
            <th class="table__cell">To</th>
            <th class="table__cell">Amount</th>
            <th class="table__cell">Status</th>
            <th class="table__cell">View details</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {{#each this.scheduledPaymentAttemptsResource.value as |paymentAttempt|}}
            <tr class="table__row">
              <td class="table__cell">
                {{formatDate paymentAttempt.startedAt "HH:mm:ss"}}
              </td>
              <td class="table__cell">
                {{formatDate paymentAttempt.startedAt "dd/MM/yyyy"}}
              </td>
              <td class="table__cell">
                {{paymentAttempt.scheduledPayment.payeeAddress}}
              </td>
              <td class="table__cell">
                {{paymentAttempt.scheduledPayment.amount}}
              </td>
              <td class="table__cell">
                {{paymentAttempt.status}}
                {{#if (eq paymentAttempt.status 'failed')}}
                  ({{paymentAttempt.failureReason}})
                {{/if}}
              </td>
              <td class="table__cell">
                {{paymentAttempt.transactionHash}}
              </td>
            </tr>
          {{/each}}

        </tbody>
      </table>
    </div>
  </template>
}

export default PaymentTransactionsList;
