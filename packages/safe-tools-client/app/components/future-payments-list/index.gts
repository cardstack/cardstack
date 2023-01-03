import Component from '@glimmer/component';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import HubAuthenticationService from '@cardstack/safe-tools-client/services/hub-authentication';
import ScheduledPaymentsService from '@cardstack/safe-tools-client/services/scheduled-payments';
import { inject as service } from '@ember/service';
import { on } from '@ember/modifier';
import { use, resource } from 'ember-resources';
import { TrackedObject } from 'tracked-built-ins';
import { taskFor } from 'ember-concurrency-ts';
import { task, TaskGenerator } from 'ember-concurrency';
import lt from 'ember-truth-helpers/helpers/lt';
import gt from 'ember-truth-helpers/helpers/gt';
import TimeBracket from './time-bracket';
import { ScheduledPayment } from '@cardstack/safe-tools-client/services/scheduled-payments';
import { addHours, addMonths, lastDayOfMonth } from 'date-fns';
import and from 'ember-truth-helpers/helpers/and';
import not from 'ember-truth-helpers/helpers/not';

import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: {
    onDepositClick: () => void;
  }
}

export default class FuturePaymentsList extends Component<Signature> {
  @service declare hubAuthentication: HubAuthenticationService;
  @service declare network: NetworkService;
  // @ts-expect-error loading services/scheduled-payments
  @service('scheduled-payments') declare scheduledPaymentsService: ScheduledPaymentsService;

  get nextHour(): ScheduledPayment[] {
    if (!this.scheduledPayments) return [];
    let now = new Date();
    let twoHourFromNow = addHours(now, 2);
    return this.scheduledPayments.filter((s: ScheduledPayment) => s.payAt >= now && s.payAt < twoHourFromNow);
  }

  get nextMonth(): ScheduledPayment[] {
    if (!this.scheduledPayments) return [];
    let now = new Date();
    let nextMonth = addMonths(now, 1);
    let firstDateNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1, 0, 0, 0, 0);
    let lastDateNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), lastDayOfMonth(nextMonth).getDate(), 23, 59, 0, 0);
    return this.scheduledPayments.filter((s: ScheduledPayment) => s.payAt >= firstDateNextMonth && s.payAt <= lastDateNextMonth);
  }

  get nextFewMonthsPayments(): ScheduledPayment[] {
    if (!this.scheduledPayments) return [];
    let now = new Date();
    let nextMonth = addMonths(now, 1);
    let lastDateNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), lastDayOfMonth(nextMonth).getDate(), 23, 59, 0, 0);
    return this.scheduledPayments.filter((s: ScheduledPayment) => s.payAt > lastDateNextMonth);
  }

  @task *loadScheduledPaymentTask(chainId: number): TaskGenerator<ScheduledPayment[]> {
    return yield this.scheduledPaymentsService.fetchScheduledPayments(chainId, new Date());
  }

  get scheduledPayments() {
    return this.scheduledPaymentsResource.value;
  }

  get isScheduledPaymentsLoading() {
    return this.scheduledPaymentsResource.isLoading;
  }

  @use scheduledPaymentsResource = resource(() => {
    if (!this.hubAuthentication.isAuthenticated) {
      return {
        error: false,
        isLoading: false,
        value: [],
      };
    }

    const state = new TrackedObject({
      isLoading: true,
      value: undefined as ScheduledPayment[] | undefined,
      error: undefined,
    });

    let chainId = this.network.chainId;

    (async () => {
      try {
        state.value = await taskFor(this.loadScheduledPaymentTask).perform(chainId);
      } catch (error) {
        state.error = error;
      } finally {
        state.isLoading = false;
      }
    })();

    return state;
  });

  <template>
    <BoxelActionContainer 
      class="future-payments-list"
      as |Section ActionChin|>
      {{#if (and (not this.isScheduledPaymentsLoading) (lt this.scheduledPayments.length 1))}}
        <Section class="future-payments-list__no-payments-section" data-test-no-future-payments-list>
          <div class="future-payments-list__no-payments-title">Schedule your first payment</div>
          <div class="future-payments-list__no-payments-description">Your future payments will show up here. This is where you can check on the status of your transactions and view important messages.</div>
        </Section>
      {{else if (and (not this.isScheduledPaymentsLoading) (gt this.scheduledPayments.length 0))}}
        <Section @title="Future Payments" data-test-future-payments-list>
          <div class="future-payments-list__payments-section">
            <div class="future-payments-list__payments-section-time-brackets">
              <TimeBracket @title="next hour" @scheduledPayments={{this.nextHour}}/>
              <TimeBracket @title="next month" @scheduledPayments={{this.nextMonth}}/>
              <TimeBracket @title="next few months" @scheduledPayments={{this.nextFewMonthsPayments}}/>
            </div>
          </div>
        </Section>
        <ActionChin @state='default'>
          <:default as |ac|>
            <ac.ActionButton {{on 'click' @onDepositClick}}>
              Add Funds
            </ac.ActionButton>
          </:default>
        </ActionChin>
      {{/if}}
    </BoxelActionContainer>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'FuturePaymentsList': typeof FuturePaymentsList;
  }
}
