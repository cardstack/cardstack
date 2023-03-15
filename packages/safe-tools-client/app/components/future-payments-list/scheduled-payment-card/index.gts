import Component from '@glimmer/component';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import { ScheduledPayment } from '@cardstack/safe-tools-client/services/scheduled-payments';
import formatDate from '@cardstack/safe-tools-client/helpers/format-date';
import tokenToUsd from '@cardstack/safe-tools-client/helpers/token-to-usd';
import PaymentOptionsDropdown from '@cardstack/safe-tools-client/components/payment-options-dropdown';
import TruncatedBlockchainAddress from '@cardstack/safe-tools-client/components/truncated-blockchain-address';

import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: {
    scheduledPayment: ScheduledPayment;
  }
}

export default class ScheduledPaymentCard extends Component<Signature> {
  get paymentType() {
    return this.args.scheduledPayment.recurringDayOfMonth && this.args.scheduledPayment.recurringUntil ? 'Recurring' : 'One-time';
  }

  <template>
    <BoxelCardContainer
      @displayBoundaries={{true}}
      class="scheduled-payment-card">
      <div class="scheduled-payment-card__content" data-test-scheduled-payment-card data-test-scheduled-payment-card-id={{@scheduledPayment.id}}>
        <span class="scheduled-payment-card__pay-at">{{this.paymentType}} on {{formatDate @scheduledPayment.payAt "d/M/yyyy (h:mm a)"}}</span>
        <div class="scheduled-payment-card__payee">
          <span class="scheduled-payment-card__payee-to">To:</span> 
          <TruncatedBlockchainAddress @address={{@scheduledPayment.payeeAddress}} @isCopyable={{true}} @copyIconColor='var(--boxel-purple-400)'/>
        </div>
        <div class="scheduled-payment-card__memo" title={{@scheduledPayment.privateMemo}}>
          {{@scheduledPayment.privateMemo}}
        </div>
        <div class="scheduled-payment-card__payment-detail">
          <img class="scheduled-payment-card__token-symbol" src={{@scheduledPayment.paymentTokenQuantity.token.logoURI}} />
          <div class="scheduled-payment-card__token-amounts">
            <span class="scheduled-payment-card__token-amount">{{@scheduledPayment.paymentTokenQuantity.displayable}}</span>
            <span class="scheduled-payment-card__usd-amount">{{tokenToUsd tokenQuantity=@scheduledPayment.paymentTokenQuantity }}</span>
          </div>
        </div>
      </div>
      <PaymentOptionsDropdown
        @scheduledPayment={{@scheduledPayment}}
        @canCancel={{true}}
      />
    </BoxelCardContainer>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'ScheduledPaymentCard': typeof ScheduledPaymentCard;
  }
}
