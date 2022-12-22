import Component from '@glimmer/component';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import NetworkService from '@cardstack/safe-tools-client/services/network';
import HubAuthenticationService from '@cardstack/safe-tools-client/services/hub-authentication';
import ScheduledPaymentsService from '@cardstack/safe-tools-client/services/scheduled-payments';
import TokensService from '@cardstack/safe-tools-client/services/tokens';
import { inject as service } from '@ember/service';
import { on } from '@ember/modifier';
import { action } from '@ember/object';
import lt from 'ember-truth-helpers/helpers/lt';

import './index.css';

export default class FuturePaymentsList extends Component {
  @service declare hubAuthentication: HubAuthenticationService;
  @service declare network: NetworkService;
  @service declare scheduledPayments: ScheduledPaymentsService;
  @service declare tokens: TokensService;
  @service declare wallet: WalletService;

  get futurePayments() {
    return [] //TODO: fetch future payments
  }

  @action
  async addFunds() {
    //TODO: implement add fund action
  }

  <template>
    <BoxelActionContainer 
      class="future-payments-list"
      as |Section ActionChin|>
      {{#if (lt this.futurePayments.length 1)}}
        <Section class="future-payments-list__no-payments-section">
          <div class="future-payments-list__no-payments-title">Scheduled your first payment</div>
          <div class="future-payments-list__no-payments-description">Your future payment will show up here. This is where you can check on the status of your transactions and view important messages.</div>
        </Section>
      {{else}}
        <Section @title="Future Payments">
          <div>TODO: Show payment card components on time brackets here</div>
        </Section>
        <ActionChin @state='default'>
          <:default as |ac|>
            <ac.ActionButton {{on 'click' this.addFunds}}>
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