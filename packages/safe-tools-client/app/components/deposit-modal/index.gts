import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { later } from '@ember/runloop';
import gt from 'ember-truth-helpers/helpers/gt';

import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import copyToClipboard from '@cardstack/boxel/helpers/copy-to-clipboard';
import cssVar from '@cardstack/boxel/helpers/css-var';
import BoxelModal from '@cardstack/boxel/components/boxel/modal';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container';
import BoxelInputGroup from '@cardstack/boxel/components/boxel/input-group';
import type { TemplateOnlyComponent } from '@ember/component/template-only';

import './index.css';

interface MonthlyTokensToCover {
  tokens: Array<{ 
    symbol: string; 
    amountToCover: number; 
  }>;
  hasEnoughBalance: boolean;
}

interface Signature {
  Element: HTMLElement;
  Args: {
    isOpen: boolean;
    onClose: () => void;
    safeAddress: string;
    networkName: string;
    tokensToCover?: {
      nextMonth: MonthlyTokensToCover;
      nextSixMonths: MonthlyTokensToCover;
    };
  };
}


export default class DepositModal extends Component<Signature> {
  @tracked isShowingCopiedConfirmation = false;

  @action flashCopiedConfirmation() {
    this.isShowingCopiedConfirmation = true;
    later(() => {
      this.isShowingCopiedConfirmation = false;
    } , 1000)
  }

  <template>
    <BoxelModal @size="small" @isOpen={{@isOpen}} @onClose={{@onClose}}>
      <BoxelActionContainer as |Section ActionChin|>
        <Section @title="Deposit Instructions" class="deposit-modal__section">
          <p>
            It is the user’s responsibility to ensure that sufficient funds are
            present in their wallet at the time of each transaction
          </p>
          <p>To deposit into your {{@networkName}} safe, transfer assets to:</p>
          <BoxelInputGroup
            @value={{@safeAddress}}
            @readonly={{true}}
            style={{cssVar
              boxel-input-group-border-radius="var(--boxel-border-radius)"
            }}
          >
            <:after as |Accessories inputGroup|>
              {{#if this.isShowingCopiedConfirmation}}
                <Accessories.Text>Copied!</Accessories.Text>
              {{/if}}
              <Accessories.IconButton
                @width="20px"
                @height="20px"
                @icon="copy"
                aria-label="Copy to Clipboard"
                {{on "click"
                  (copyToClipboard
                    elementId=inputGroup.elementId
                    onCopy=this.flashCopiedConfirmation
                  )
                }}
              />
            </:after>
          </BoxelInputGroup>
          {{#if @tokensToCover}}
            <div class="deposit-modal__section-funds-info">
              {{svgJar "info" class="deposit-modal__section-funds-info-icon"}}
              <div class="deposit-modal__section-funds-info-header">
                How much should you transfer?
                <p>
                  It is your choice how far in advance you fund your safe. As a convenience,
                  we have calculated this safe’s funding needs for your currently scheduled
                  transactions:
                </p>
                <TokensToCoverByTime
                  @periodOfTime="4 weeks"
                  @monthlyTokens={{@tokensToCover.nextMonth}}
                />
                <TokensToCoverByTime
                  @periodOfTime="6 months"
                  @monthlyTokens={{@tokensToCover.nextSixMonths}}
                />
              </div>
            </div>
           {{/if}} 
        </Section>
        <ActionChin @state="default">
          <:default as |a|>
            <a.ActionButton {{on "click" @onClose}}>
              Close
            </a.ActionButton>
          </:default>
        </ActionChin>
      </BoxelActionContainer>
    </BoxelModal>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'DepositModal': typeof DepositModal;
  }
}


interface TokensToCoverByTimeSignature { 
  Element: HTMLElement;
  Args: {
    periodOfTime: string;
    monthlyTokens: MonthlyTokensToCover;
  };
}

export const TokensToCoverByTime: TemplateOnlyComponent<TokensToCoverByTimeSignature> = <template>
  <p class="deposit-modal__section-funds-info-balance">
    <span class="deposit-modal__section-funds-info-cover">
      ...to cover the next {{@periodOfTime}}:
    </span>
    <div class="deposit-modal__section-funds-info-cover-balances">
      {{#if @monthlyTokens.hasEnoughBalance}}
        <b>Covered by current balances</b>
      {{else}}
        <ul class="deposit-modal__section-funds-info-token-list">
          {{#each @monthlyTokens.tokens as |token|}}
            {{#if (gt token.amountToCover 0)}}
              <li class="deposit-modal__section-funds-info-token">
                {{!-- TOD0: Map token from symbol --}}
                {{svgJar "card"}} {{token.amountToCover}} {{token.symbol}}
              </li>
            {{/if}}
          {{/each}}
        </ul>
      {{/if}}
    </div>
  </p>
</template>