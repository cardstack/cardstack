import Component from '@glimmer/component';

import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import BoxelHeader from '@cardstack/boxel/components/boxel/header';
import ScheduledPaymentCard from '../scheduled-payment-card';
import { ScheduledPayment } from '@cardstack/safe-tools-client/services/scheduled-payments';
import gt from 'ember-truth-helpers/helpers/gt';

import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: {
    title: string;
    scheduledPayments: ScheduledPayment[];
    reloadScheduledPayments: () => void;
  }
}

export default class ScheduledPaymentTimeBracket extends Component<Signature> {
  <template>
    {{#if (gt @scheduledPayments.length 0)}}
      <BoxelCardContainer class="scheduled-payment-time-bracket" data-test-time-bracket={{@title}}>
        {{#if @title}}
          <BoxelHeader @header={{@title}} @noBackground={{true}}/>
        {{/if}}

        {{#each @scheduledPayments as |scheduledPayment|}}
          <ScheduledPaymentCard @scheduledPayment={{scheduledPayment}} @reloadScheduledPayments={{@reloadScheduledPayments}} />
        {{/each}}
      </BoxelCardContainer>
    {{/if}}
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'ScheduledPaymentTimeBracket': typeof ScheduledPaymentTimeBracket;
  }
}