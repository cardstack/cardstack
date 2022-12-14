
import Component from '@glimmer/component';

import './index.css';
import { use, resource } from 'ember-resources';
import BlockExplorerButton from '@cardstack/safe-tools-client/components/block-explorer-button';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import HubAuthenticationService from '@cardstack/safe-tools-client/services/hub-authentication';
import ScheduledPaymentsService, { ScheduledPaymentAttempt } from '@cardstack/safe-tools-client/services/scheduled-payments';
import { inject as service } from '@ember/service';
import { TrackedObject } from 'tracked-built-ins';
import eq from 'ember-truth-helpers/helpers/eq';
import formatDate from '@cardstack/safe-tools-client/helpers/format-date';
import { taskFor } from 'ember-concurrency-ts';
import { task, TaskGenerator } from 'ember-concurrency';
import weiToDecimal from '@cardstack/safe-tools-client/helpers/wei-to-decimal';
import { type TokenInfo } from '@uniswap/token-lists';
import TokensService from '@cardstack/safe-tools-client/services/tokens';

class PaymentTransactionsList extends Component {
  @service declare wallet: WalletService;
  @service declare network: NetworkService;
  @service declare hubAuthentication: HubAuthenticationService;
  @service declare scheduledPayments: ScheduledPaymentsService;

  @service declare tokens: TokensService;

  get paymentAttempts() {
    if (!this.scheduledPaymentAttemptsResource.value) return [];

    return this.scheduledPaymentAttemptsResource.value.map((scheduledPaymentAttempt) => {
      const tokenInfo = this.tokens.transactionTokens.find((t) => t.address === scheduledPaymentAttempt.scheduledPayment.tokenAddress) as TokenInfo;
      return { ...scheduledPaymentAttempt, tokenInfo };
    });
  }

  @task *loadScheduledPaymentAttemptsTask(chainId: number): TaskGenerator<ScheduledPaymentAttempt[]> {
    return yield this.scheduledPayments.fetchScheduledPaymentAttempts(chainId);
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

    let chainId = this.network.chainId;

    (async () => {
      try {
        state.value = await taskFor(this.loadScheduledPaymentAttemptsTask).perform(chainId);
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
    <table class="table" data-test-scheduled-payment-attempts>
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
        {{#each this.paymentAttempts as |paymentAttempt index|}}
          <tr class="table__row" data-test-scheduled-payment-attempts-item={{index}}>
            <td class="table__cell" data-test-scheduled-payment-attempts-item-time>
              {{formatDate paymentAttempt.startedAt "HH:mm:ss"}}
            </td>
            <td class="table__cell" data-test-scheduled-payment-attempts-item-date>
              {{formatDate paymentAttempt.startedAt "dd/MM/yyyy"}}
            </td>
            <td class="table__cell blockchain-address transactions-table-item-payee" data-test-scheduled-payment-attempts-item-payee>
              {{paymentAttempt.scheduledPayment.payeeAddress}}
            </td>
            <td class="table__cell" data-test-scheduled-payment-attempts-item-amount>
              {{weiToDecimal paymentAttempt.scheduledPayment.amount paymentAttempt.tokenInfo.decimals}} {{paymentAttempt.tokenInfo.symbol}}
            </td>
            <td class="table__cell" data-test-scheduled-payment-attempts-item-status>
              {{paymentAttempt.status}}
              {{#if (eq paymentAttempt.status 'failed')}}
                ({{paymentAttempt.failureReason}})
              {{/if}}
            </td>
            <td class="table__cell" data-test-scheduled-payment-attempts-blockexplorer>
              <BlockExplorerButton
                @networkSymbol={{this.network.symbol}}
                @transactionHash={{paymentAttempt.transactionHash}}
                data-test-scheduled-payment-attempts-item-explorer-button
              />
            </td>
          </tr>
        {{/each}}
      </tbody>
    </table>
  </template>
}

export default PaymentTransactionsList;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'PaymentTransactionsList': typeof PaymentTransactionsList;
  }
}
