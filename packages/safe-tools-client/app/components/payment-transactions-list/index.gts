
import Component from '@glimmer/component';

import './index.css';
import { use, resource } from 'ember-resources';
import BlockExplorerButton from '@cardstack/safe-tools-client/components/block-explorer-button';
import BoxelDropdown from '@cardstack/boxel/components/boxel/dropdown';
import BoxelDropdownTrigger from '@cardstack/boxel/components/boxel/dropdown/trigger';
import BoxelMenu from '@cardstack/boxel/components/boxel/menu';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import HubAuthenticationService from '@cardstack/safe-tools-client/services/hub-authentication';
import ScheduledPaymentsService, { ScheduledPaymentAttempt, type ScheduledPaymentAttemptStatus } from '@cardstack/safe-tools-client/services/scheduled-payments';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { TrackedObject } from 'tracked-built-ins';
import eq from 'ember-truth-helpers/helpers/eq';
import or from 'ember-truth-helpers/helpers/or';
import { array, concat } from '@ember/helper';
import set from 'ember-set-helper/helpers/set';
import menuItem from '@cardstack/boxel/helpers/menu-item'
import formatDate from '@cardstack/safe-tools-client/helpers/format-date';
import { taskFor } from 'ember-concurrency-ts';
import { task, TaskGenerator } from 'ember-concurrency';
import weiToDecimal from '@cardstack/safe-tools-client/helpers/wei-to-decimal';
import { type TokenInfo } from '@uniswap/token-lists';
import TokensService from '@cardstack/safe-tools-client/services/tokens';

class PaymentTransactionsList extends Component {
  @service declare hubAuthentication: HubAuthenticationService;
  @service declare network: NetworkService;
  @service declare scheduledPayments: ScheduledPaymentsService;
  @service declare tokens: TokensService;
  @service declare wallet: WalletService;
  
  @tracked statusFilter?: ScheduledPaymentAttemptStatus;

  get paymentAttempts() {
    if (!this.scheduledPaymentAttemptsResource.value) return [];

    return this.scheduledPaymentAttemptsResource.value.map((scheduledPaymentAttempt) => {
      const tokenInfo = this.tokens.transactionTokens.find((t) => t.address === scheduledPaymentAttempt.scheduledPayment.tokenAddress) as TokenInfo;
      return { ...scheduledPaymentAttempt, tokenInfo };
    });
  }

  @task *loadScheduledPaymentAttemptsTask(chainId: number, status?: ScheduledPaymentAttemptStatus): TaskGenerator<ScheduledPaymentAttempt[]> {
    return yield this.scheduledPayments.fetchScheduledPaymentAttempts(chainId, status);
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
        state.value = await taskFor(this.loadScheduledPaymentAttemptsTask).perform(chainId, this.statusFilter);
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
    <div>
      <BoxelDropdown>
        <:trigger as |bindings|>
          <BoxelDropdownTrigger
            @label={{concat 'Status: ' (or this.statusFilter 'All')}}
            {{bindings}}
            data-test-scheduled-payment-status-filter
          />
        </:trigger>
        <:content as |dd|>
          <BoxelMenu
            @closeMenu={{dd.close}}
            @items={{array
              (menuItem "All" (set this 'statusFilter' undefined))
              (menuItem "Succeeded" (set this 'statusFilter' 'succeeded'))
              (menuItem "Failed" (set this 'statusFilter' 'failed'))
              (menuItem "In Progress" (set this 'statusFilter' 'inProgress'))
            }}
          />
        </:content>
      </BoxelDropdown>
    </div>
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
