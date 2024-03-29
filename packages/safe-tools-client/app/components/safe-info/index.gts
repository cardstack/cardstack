import Component from '@glimmer/component';
import BoxelSelect from '@cardstack/boxel/components/boxel/select';
import BoxelButton from '@cardstack/boxel/components/boxel/button';
import or from 'ember-truth-helpers/helpers/or';
import gt from 'ember-truth-helpers/helpers/gt';
import { on } from '@ember/modifier';
import TruncatedBlockchainAddress from '@cardstack/safe-tools-client/components/truncated-blockchain-address';
import nativeUnitsToDecimal from '@cardstack/safe-tools-client/helpers/native-units-to-decimal';
import CreateSafeButton from '@cardstack/safe-tools-client/components/create-safe-button';
import { Safe, TokenBalance } from '@cardstack/safe-tools-client/services/safes';
import not from 'ember-truth-helpers/helpers/not';

import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    currentSafe: Safe | undefined;
    safes: Safe[] | undefined;
    isLoadingSafes: boolean | undefined;
    tokenBalances: TokenBalance[] | undefined;
    isLoadingTokenBalances: boolean;
    safesLoadingError: Error | undefined;
    onDepositClick: () => void;
    onSelectSafe: (safe: Safe) => void;
  }
}

export default class SafeInfo extends Component<Signature> {
  get safesHaveLoadedInitially() {
    return this.args.safes !== undefined;
  }
  get safes() {
    return this.args.safes || [];
  }

  <template>
    {{#if @isLoadingSafes}}
      <div class='info'>Loading safes...</div>
    {{else if (gt @safes.length 1)}}
      <BoxelSelect
        class='safe-tools__dashboard-dropdown'
        @selected={{@currentSafe}}
        @selectedItemComponent={{
          (component 
            TruncatedBlockchainAddress 
            address=@currentSafe.address 
            isCopyable=true
            copyIconColor='var(--boxel-light)')}}
        @onChange={{@onSelectSafe}}
        @options={{this.safes}}
        @dropdownClass="boxel-select-usage-dropdown"
        data-test-safe-dropdown
        as |safe itemCssClass|>
        <div class="{{itemCssClass}} blockchain-address"><TruncatedBlockchainAddress @address={{safe.address}} @isCopyable={{false}}/></div>
      </BoxelSelect>
    {{else if @currentSafe.address}}
      <div class='safe-tools__dashboard-schedule-control-panel-address' title={{@currentSafe.address}} data-test-safe-address-label>
        <TruncatedBlockchainAddress @address={{(or @currentSafe.address '')}} @isCopyable={{true}} @copyIconColor='var(--boxel-light)'/>
      </div>
    {{/if}}

    {{#if @currentSafe}}
      {{#if @isLoadingTokenBalances}}
        <div class='info'>Loading token balances...</div>
      {{else}}
        <div>
          {{#each @tokenBalances as |tokenBalance|}}
            {{#let (nativeUnitsToDecimal tokenBalance.balance tokenBalance.decimals)
              as |balanceDecimalValue|
            }}
              {{!-- Don't show zero balances and crypto dust --}}
              {{#if (gt tokenBalance.balance 0.0001)}}
                <div class='safe-tools_safe-info-balance' data-test-token-balance={{tokenBalance.symbol}}>
                  {{balanceDecimalValue}} {{tokenBalance.symbol}}
                </div>
              {{/if}}
            {{/let}}
          {{/each}}
        </div>

        <BoxelButton @kind='primary' {{on 'click' @onDepositClick}}>
          Add Funds
        </BoxelButton>
      {{/if}}
    {{else if this.safesHaveLoadedInitially}}
      <p class='info'>
        To schedule payments, you need to have a safe which contains funds that would be deducted
        automatically when scheduled payments are due.
      </p>
    {{/if}}

    {{#if @safesLoadingError}}
      <div class="info">⚠️ {{@safesLoadingError.message}}</div>
    {{/if}}
    
    {{#if (not @isLoadingSafes)}}
      <CreateSafeButton
        @currentSafe={{@currentSafe}}
        @onNextAfterSafeCreated={{@onDepositClick}}
      />
    {{/if}}
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'SafeInfo': typeof SafeInfo;
  }
}
