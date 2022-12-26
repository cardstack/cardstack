import Component from '@glimmer/component';
import BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import BoxelIconButton from '@cardstack/boxel/components/boxel/icon-button';
import { ScheduledPayment } from '@cardstack/safe-tools-client/services/scheduled-payments';
import formatDate from '@cardstack/safe-tools-client/helpers/format-date';
import truncateMiddle from '@cardstack/safe-tools-client/helpers/truncate-middle';
import weiToDecimal from '@cardstack/safe-tools-client/helpers/wei-to-decimal';
import { inject as service } from '@ember/service';
import TokensService from '@cardstack/safe-tools-client/services/tokens';

import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: {
    scheduledPayment: ScheduledPayment;
  }
}

export default class ScheduledPaymentCard extends Component<Signature> {
  @service declare tokens: TokensService;

  get token() {
    let tokens = this.tokens.transactionTokens;
    let token = tokens.find(token => token.address === this.args.scheduledPayment.tokenAddress)
    if (!token) {
      throw new Error('unknown transfer token');
    }
    return token;
  }

  <template>
    <BoxelCardContainer 
      @displayBoundaries={{true}}
      class="scheduled-payment-card">
      <div class="scheduled-payment-card__content" data-test-scheduled-payment-card>
        <span class="scheduled-payment-card__content-pay-at">Recurring on {{formatDate @scheduledPayment.payAt "d/M/yyyy"}}</span>
        <span class="scheduled-payment-card__content-payee">To: {{truncateMiddle @scheduledPayment.payeeAddress}}</span>
        <div class="scheduled-payment-card_content-payment-detail">
          <img class="scheduled-payment-card_content-token-symbol" src={{this.token.logoURI}} />
          <div class="scheduled-payment-card_content-token-amounts">
            <span class="scheduled-payment-card_content-token-amount">{{weiToDecimal @scheduledPayment.amount this.token.decimals}} {{this.token.symbol}}</span>
            {{!-- TODO: Add the right USD amount --}}
            <span class="scheduled-payment-card_content-usd-amount">$ 1000 USD</span> 
          </div>
        </div>
      </div>
      <BoxelIconButton
        @icon="more-actions"
        @height="30px"
        aria-label="More Actions"
      />
    </BoxelCardContainer>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'ScheduledPaymentCard': typeof ScheduledPaymentCard;
  }
}