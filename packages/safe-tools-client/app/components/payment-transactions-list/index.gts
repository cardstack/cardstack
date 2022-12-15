
import Component from '@glimmer/component';

import './index.css';
import { use, resource } from 'ember-resources';
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
import BoxelInputFilterSelect from '@cardstack/boxel/components/boxel/input/filter-select';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { array } from '@ember/helper';

class PaymentTransactionsList extends Component {
  @service declare wallet: WalletService;
  @service declare network: NetworkService;
  @service declare hubAuthentication: HubAuthenticationService;
  @service declare scheduledPayments: ScheduledPaymentsService;

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

  @tracked dateFilter: string | undefined;
  @action onSelectDateFilter(selectedDateFilter: string) {
    this.dateFilter = selectedDateFilter;
  }

  @tracked statusFilter: string | undefined;
  @action onSelectStatusFilter(selectedStatusFilter: string) {
    this.statusFilter = selectedStatusFilter;
  }

  <template>
    <div class="payment-transactions-list__filter_wrapper">
      <BoxelInputFilterSelect
        @value={{this.dateFilter}}
        @label="Date"
        @options={{array "Last 30 Days" "Last 90 Days" "Last 120 Days"}}
        @onChooseFilter={{this.onSelectDateFilter}}
      />
      <BoxelInputFilterSelect
        @value={{this.statusFilter}}
        @label="Status"
        @options={{array "All" "Pending" "Failed" "Confirmed"}}
        @onChooseFilter={{this.onSelectStatusFilter}}
      />
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
        {{#each this.scheduledPaymentAttemptsResource.value as |paymentAttempt index|}}
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
              {{paymentAttempt.scheduledPayment.amount}}
            </td>
            <td class="table__cell" data-test-scheduled-payment-attempts-item-status>
              {{paymentAttempt.status}}
              {{#if (eq paymentAttempt.status 'failed')}}
                ({{paymentAttempt.failureReason}})
              {{/if}}
            </td>
            <td class="table__cell" data-test-scheduled-payment-attempts-blockexplorer>
              {{paymentAttempt.transactionHash}}
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
