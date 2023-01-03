import Component from '@glimmer/component';
import BoxelSelect from '@cardstack/boxel/components/boxel/select';
import BoxelButton from '@cardstack/boxel/components/boxel/button';
import or from 'ember-truth-helpers/helpers/or';
import gt from 'ember-truth-helpers/helpers/gt';
import { on } from '@ember/modifier';
import truncateMiddle from '@cardstack/safe-tools-client/helpers/truncate-middle';
import weiToDecimal from '@cardstack/safe-tools-client/helpers/wei-to-decimal';
import CreateSafe from '@cardstack/safe-tools-client/components/create-safe';
import { Safe, TokenBalance } from '@cardstack/safe-tools-client/services/safes';

import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    currentSafe: Safe | undefined;
    safes: Safe[] | undefined;
    tokenBalances: TokenBalance[] | undefined;
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
    {{#if (gt @safes.length 1)}}
      <BoxelSelect
        class='safe-tools__dashboard-dropdown'
        @selected={{@currentSafe}}
        @onChange={{@onSelectSafe}}
        @options={{this.safes}}
        @dropdownClass="boxel-select-usage-dropdown"
        data-test-safe-dropdown
        as |safe itemCssClass|>
        <div class="{{itemCssClass}} blockchain-address">{{truncateMiddle safe.address}}</div>
      </BoxelSelect>
    {{else}}
      <div class='safe-tools__dashboard-schedule-control-panel-address' title={{@currentSafe.address}} data-test-safe-address-label>
        {{truncateMiddle (or @currentSafe.address '')}}
      </div>
    {{/if}}

    {{#if @currentSafe}}
      <div>
        {{#each @tokenBalances as |tokenBalance|}}
          {{#let (weiToDecimal tokenBalance.balance tokenBalance.decimals)
            as |balanceDecimalValue|
          }}
            {{!-- Don't show zero balances and crypto dust --}}
            {{#if (or tokenBalance.isNativeToken (gt tokenBalance.balance 0.0001))}}
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
    {{else if this.safesHaveLoadedInitially}}
      <p class='info'>
        To schedule payments, you need to have a safe which contains funds that would be deducted
        automatically when scheduled payments are due.
      </p>
    {{/if}}

    {{#if @safesLoadingError}}
      <div class="info">⚠️ {{@safesLoadingError.message}}</div>
    {{/if}}

    <CreateSafe @currentSafe={{@currentSafe}} />
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'SafeInfo': typeof SafeInfo;
  }
}
