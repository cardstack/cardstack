
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
import SafesService from '@cardstack/safe-tools-client/services/safes';
import ScheduledPaymentsService, { ScheduledPaymentAttempt, type ScheduledPaymentAttemptStatus } from '@cardstack/safe-tools-client/services/scheduled-payments';
import TokensService from '@cardstack/safe-tools-client/services/tokens';
import PaymentOptionsDropdown from '@cardstack/safe-tools-client/components/payment-options-dropdown';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { TrackedObject } from 'tracked-built-ins';
import eq from 'ember-truth-helpers/helpers/eq';
import and from 'ember-truth-helpers/helpers/and';
import not from 'ember-truth-helpers/helpers/not';
import { concat, fn } from '@ember/helper';
import { menuItemFunc, MenuItem } from '@cardstack/boxel/helpers/menu-item'
import formatDate from '@cardstack/safe-tools-client/helpers/format-date';
import { taskFor } from 'ember-concurrency-ts';
import { task, TaskGenerator } from 'ember-concurrency';
import paymentErrorMessage from '@cardstack/safe-tools-client/helpers/payment-error-message';
import { subDays } from 'date-fns';
import { action } from '@ember/object';
import map from 'ember-composable-helpers/helpers/map';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container';

type FilterItem = {
  display: string,
  value: any | undefined
};

class PaymentTransactionsList extends Component {
  @service declare hubAuthentication: HubAuthenticationService;
  @service declare network: NetworkService;
  @service declare scheduledPayments: ScheduledPaymentsService;
  @service declare safes: SafesService;
  @service declare tokens: TokensService;
  @service declare wallet: WalletService;

  readonly dateFilters: FilterItem[] = [
    { display: 'Last 30 days', value: subDays(new Date(), 30) },
    { display: 'Last 90 days', value: subDays(new Date(), 90) },
    { display: 'Last 120 days', value: subDays(new Date(), 120) },
  ]
  @tracked dateFilter: FilterItem = this.dateFilters[0];
  @action setDateFilter(dateFilter: FilterItem) {
    this.dateFilter = dateFilter;
  }

  readonly statusFilters: FilterItem[] = [
    { display: 'All', value: undefined },
    { display: 'Succeeded', value: 'succeeded' },
    { display: 'Failed', value: 'failed' },
    { display: 'In Progress', value: 'inProgress' },
  ]
  @tracked statusFilter: FilterItem = this.statusFilters[0];
  @action setStatusFilter(statusFilter: FilterItem) {
    this.statusFilter = statusFilter;
  }

  get paymentAttempts() {
    return this.scheduledPaymentAttemptsResource.value || []
  }

  @task *loadScheduledPaymentAttemptsTask(chainId: number, senderSafeAddress: string, status?: ScheduledPaymentAttemptStatus, startedAt?: Date): TaskGenerator<ScheduledPaymentAttempt[]> {
    return yield this.scheduledPayments.fetchScheduledPaymentAttempts(chainId, senderSafeAddress, status, startedAt);
  }

  @use scheduledPaymentAttemptsResource = resource(() => {
    let senderSafeAddress = this.safes.currentSafe?.address;
    if (!this.hubAuthentication.isAuthenticated || !senderSafeAddress) {
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
        state.value = await taskFor(this.loadScheduledPaymentAttemptsTask).perform(chainId, senderSafeAddress, this.statusFilter.value ? this.statusFilter.value as ScheduledPaymentAttemptStatus : undefined, this.dateFilter.value);
      } catch (error) {
        console.log(error);
        state.error = error;
      } finally {
        state.isLoading = false;
      }
    })();

    return state;
  });

  @action buildMenuItem(onChoose: (val: FilterItem) => void, option: FilterItem): MenuItem {
    return menuItemFunc([option.display, () => onChoose(option)], {});
  }

  <template>
    <BoxelActionContainer class="past-payments-list" as |Section|>
      <Section @title="Past Payments">
        <BoxelDropdown>
          <:trigger as |bindings|>
            <BoxelDropdownTrigger
              @label={{concat 'Date: ' this.dateFilter.display}}
              {{bindings}}
              class="payment-transactions-list__filter-trigger"
              data-test-scheduled-payment-date-filter
            />
          </:trigger>
          <:content as |dd|>
            <BoxelMenu
              @closeMenu={{dd.close}}
              @items={{map (fn this.buildMenuItem this.setDateFilter) this.dateFilters}}
            />
          </:content>
        </BoxelDropdown>
        <BoxelDropdown>
          <:trigger as |bindings|>
            <BoxelDropdownTrigger
              @label={{concat 'Status: ' this.statusFilter.display}}
              {{bindings}}
              class="payment-transactions-list__filter-trigger"
              data-test-scheduled-payment-status-filter
            />
          </:trigger>
          <:content as |dd|>
            <BoxelMenu
              @closeMenu={{dd.close}}
              @items={{map (fn this.buildMenuItem this.setStatusFilter) this.statusFilters}}
            />
          </:content>
        </BoxelDropdown>

        <table class="table" data-test-scheduled-payment-attempts>
          <thead class="table__header">
            <tr class="table__row">
              <th class="table__cell">Time</th>
              <th class="table__cell">Date</th>
              <th class="table__cell">To</th>
              <th class="table__cell">Amount</th>
              <th class="table__cell">Status</th>
              <th class="table__cell">View details</th>
              <th class="table__cell">Actions</th>
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
                  <strong>{{paymentAttempt.scheduledPayment.paymentTokenQuantity.displayable}}</strong>
                </td>
                <td class="table__cell" data-test-scheduled-payment-attempts-item-status>
                  {{#if (eq paymentAttempt.status 'succeeded')}}
                    🟢 <span class="transactions-table-item-status-text">Confirmed</span>
                  {{else if (eq paymentAttempt.status 'failed')}}
                    {{#if paymentAttempt.scheduledPayment.isCanceled}}
                      🟠 <span class="transactions-table-item-status-text">Canceled</span>
                    {{else}}
                      🔴 <span class="transactions-table-item-status-text">Failed</span>
                      <span class="transactions-table-item-status-failure-reason">
                        ({{paymentErrorMessage paymentAttempt.failureReason}})
                       </span>
                    {{/if}}
                  {{else}}
                    🔵 <span class="transactions-table-item-status-text">Pending</span>
                  {{/if}}
                </td>
                <td class="table__cell" data-test-scheduled-payment-attempts-blockexplorer>
                  <BlockExplorerButton
                    @networkSymbol={{this.network.symbol}}
                    @transactionHash={{paymentAttempt.transactionHash}}
                    data-test-scheduled-payment-attempts-item-explorer-button
                  />
                </td>
                <td class="table__cell">
                  {{!-- TODO: only show options for < 3 attempt, when this info is stored --}}
                  {{#if (and (eq paymentAttempt.status 'failed') (not paymentAttempt.scheduledPayment.isCanceled))}}
                    <PaymentOptionsDropdown @scheduledPayment={{paymentAttempt.scheduledPayment}}/>
                  {{/if}}
                </td>
              </tr>
            {{/each}}
          </tbody>
        </table>

        {{#if (eq this.paymentAttempts.length 0)}}
          <div class="transactions-table-empty-explanation" data-test-scheduled-payment-attempts-empty>
            No payments found.
          </div>
        {{/if}}
      </Section>
    </BoxelActionContainer>
  </template>
}

export default PaymentTransactionsList;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'PaymentTransactionsList': typeof PaymentTransactionsList;
  }
}
