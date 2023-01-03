import Component from '@glimmer/component';

import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import BoxelHeader from '@cardstack/boxel/components/boxel/header';
import ScheduledPaymentCard from '../scheduled-payment-card';
import { ScheduledPayment } from '@cardstack/safe-tools-client/services/scheduled-payments';

import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: {
    title: string;
    scheduledPayments: ScheduledPayment[]; 
  }
}

export default class ScheduledPaymentTimeBracket extends Component<Signature> {
  <template>
    <BoxelCardContainer class="scheduled-payment-time-bracket" data-test-time-bracket={{@title}}>
      <BoxelHeader @header={{@title}} @noBackground={{true}}/>
      {{#each @scheduledPayments as |scheduledPayment|}}
        <ScheduledPaymentCard @scheduledPayment={{scheduledPayment}}/>
      {{/each}}
    </BoxelCardContainer>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'ScheduledPaymentTimeBracket': typeof ScheduledPaymentTimeBracket;
  }
}