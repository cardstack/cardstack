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
import TimeBracket from './time-bracket';
import { ScheduledPayment } from '@cardstack/safe-tools-client/services/scheduled-payments';
import { addMinutes, addDays } from 'date-fns';
import { BigNumber } from 'ethers';

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
  @service declare scheduledPayments: ScheduledPaymentsService;
  @service declare tokens: TokensService;
  @service declare wallet: WalletService;

  get futurePayments(): ScheduledPayment[] {
    let transactionTokens = this.tokens.transactionTokens;
    let usdcToken = transactionTokens.find(t => t.symbol.includes('USDC'));
    let wethToken = transactionTokens.find(t => t.symbol.includes('WETH'));
    return [{
      amount: BigNumber.from('10000000'),
      feeFixedUSD: '0',
      feePercentage: '0',
      gasTokenAddress: '0x123',
      tokenAddress: usdcToken?.address ?? '',
      chainId: usdcToken ? usdcToken.chainId : 1,
      payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
      payAt: addMinutes(addDays(new Date(), 10), 120),
    },
    {
      amount: BigNumber.from('10000000'),
      feeFixedUSD: '0',
      feePercentage: '0',
      gasTokenAddress: '0x123',
      tokenAddress: wethToken?.address ?? '',
      chainId: wethToken ? wethToken.chainId : 1,
      payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
      payAt: addMinutes(addDays(new Date(), 10), 120),
    }] //TODO: fetch future payments
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
        <Section @title="Future Payments" class="future-payments-list__payments-section">
          <div class="future-payments-list__payments-section-time-brackets">
            <TimeBracket @title={{"next hour"}} @scheduledPayments={{this.futurePayments}}/>
            <TimeBracket @title={{"next month"}} @scheduledPayments={{this.futurePayments}}/>
            <TimeBracket @title={{"next few months"}} @scheduledPayments={{this.futurePayments}}/>
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