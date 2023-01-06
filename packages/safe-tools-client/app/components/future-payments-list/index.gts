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
import ScheduledPaymentTimeBracket from './scheduled-payment-time-bracket';
import { ScheduledPayment } from '@cardstack/safe-tools-client/services/scheduled-payments';
import { addDays, startOfDay, endOfDay, endOfMonth } from 'date-fns';
import and from 'ember-truth-helpers/helpers/and';
import not from 'ember-truth-helpers/helpers/not';
import DateService from 'ember-date-service/service/date';

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
  @service declare date: DateService;
  
  get now(): Date {
    return new Date(Number(this.date.now()));
  }

  get today(): ScheduledPayment[] {
    if (!this.scheduledPayments) return [];
    let startOfToday = startOfDay(this.now);
    let endOfToday = endOfDay(this.now);
    return this.scheduledPayments.filter((s: ScheduledPayment) => s.payAt >= startOfToday && s.payAt <= endOfToday);
  }

  get tomorrow(): ScheduledPayment[] {
    if (!this.scheduledPayments) return [];
    let tomorrow = addDays(this.now, 1);
    let startOfTomorrow = startOfDay(tomorrow);
    let endOfTomorrow = endOfDay(tomorrow);
    return this.scheduledPayments.filter((s: ScheduledPayment) => s.payAt >= startOfTomorrow && s.payAt <= endOfTomorrow);
  }

  get thisMonth(): ScheduledPayment[] {
    if (!this.scheduledPayments) return [];
    let tomorrow = addDays(this.now, 1);
    let endOfTomorrow = endOfDay(tomorrow);
    let endOfThisMonth = endOfMonth(endOfTomorrow);
    return this.scheduledPayments.filter((s: ScheduledPayment) => s.payAt > endOfTomorrow && s.payAt <= endOfThisMonth);
  }

  get later(): ScheduledPayment[] {
    if (!this.scheduledPayments) return [];
    let tomorrow = addDays(this.now, 1);
    let endOfTomorrow = endOfDay(tomorrow);
    let endOfThisMonth = endOfMonth(endOfTomorrow);
    return this.scheduledPayments.filter((s: ScheduledPayment) => s.payAt > endOfThisMonth);
  }

  @task *loadScheduledPaymentTask(chainId: number): TaskGenerator<ScheduledPayment[]> {
    return yield this.scheduledPaymentsService.fetchScheduledPayments(chainId, this.now);
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
              <ScheduledPaymentTimeBracket @title="today" @scheduledPayments={{this.today}}/>
              <ScheduledPaymentTimeBracket @title="tomorrow" @scheduledPayments={{this.tomorrow}}/>
              <ScheduledPaymentTimeBracket @title="this month" @scheduledPayments={{this.thisMonth}}/>
              <ScheduledPaymentTimeBracket @title="later" @scheduledPayments={{this.later}}/>
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
