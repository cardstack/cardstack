import Component from '@glimmer/component';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container';
import BoxelButton from '@cardstack/boxel/components/boxel/button';
import BoxelField from '@cardstack/boxel/components/boxel/field';
import BoxelInputDate, { Day } from '@cardstack/boxel/components/boxel/input/date';
import BoxelInputTime, { Time } from '@cardstack/boxel/components/boxel/input/time';
import BoxelInput from '@cardstack/boxel/components/boxel/input';
import BoxelInputSelectableTokenAmount from '@cardstack/boxel/components/boxel/input/selectable-token-amount';
import BoxelLoadingIndicator from '@cardstack/boxel/components/boxel/loading-indicator';
import BoxelRadioInput from '@cardstack/boxel/components/boxel/radio-input';
import BoxelToggleButtonGroup from '@cardstack/boxel/components/boxel/toggle-button-group';
import BoxelTokenSelect from '@cardstack/boxel/components/boxel/input/token-select';
import RangedNumberPicker from '@cardstack/boxel/components/boxel/input/ranged-number-picker';
import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import { concat, fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import { tracked } from '@glimmer/tracking';
import eq from 'ember-truth-helpers/helpers/eq';
import and from 'ember-truth-helpers/helpers/and';
import not from 'ember-truth-helpers/helpers/not';
import set from 'ember-set-helper/helpers/set';
import './index.css';
import { MaxGasFeeOption, ValidatableForm } from '../validator';
import BlockExplorerButton from '@cardstack/safe-tools-client/components/block-explorer-button';
import { SchedulerCapableNetworks, TransactionHash } from '@cardstack/cardpay-sdk';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { type WalletProviderId } from '@cardstack/safe-tools-client/utils/wallet-providers';
import { ConfiguredScheduledPaymentFees } from '@cardstack/safe-tools-client/services/scheduled-payment-sdk';
import formatUsd from '@cardstack/safe-tools-client/helpers/format-usd';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import { inject as service } from '@ember/service';

interface Signature {
  Element: HTMLElement;
  Args: ValidatableForm & {
    paymentTypeOptions: { id: string, text: string }[];
    onSelectPaymentType: (paymentTypeId: string) => void;
    isPaymentTypeInvalid: boolean;
    paymentTypeErrorMessage: string;
    onSetPaymentDate: (day: Day) => void;
    onSetPaymentTime: (time: Time) => void;
    onSelectPaymentDayOfMonth: (val: number) => void;
    onSetMonthlyUntil: (date: Date) => void;
    isPayeeAddressInvalid: boolean;
    payeeAddressErrorMessage: string;
    onUpdatePaymentAmount: (val: string) => void;
    isPaymentAmountInvalid: boolean;
    paymentAmountErrorMessage: string;
    paymentTokens: SelectableToken[];
    onUpdatePaymentToken: (val: SelectableToken) => void;
    gasTokens: SelectableToken[];
    onSelectGasToken: (val: SelectableToken) => void;
    maxGasDescriptions?: Record<MaxGasFeeOption, string>;
    isGasTokenInvalid: boolean;
    gasTokenErrorMessage: string;
    onUpdateMaxGasPrice: (val: string) => void;
    isMaxGasPriceInvalid: boolean;
    maxGasPriceErrorMessage: string;
    configuredFees: ConfiguredScheduledPaymentFees | undefined;
    onSchedulePayment: () => void;
    onUpdatePayeeAddress: (val: string) => void;
    onReset: () => void;
    isSubmitEnabled: boolean;
    schedulingStatus: string | undefined;
    networkSymbol: SchedulerCapableNetworks;
    walletProviderId: WalletProviderId | undefined;
    txHash: TransactionHash | undefined;
    isSuccessfullyScheduled: boolean;
    isSafesEmpty: boolean;
  }
}

export default class SchedulePaymentFormActionCardUI extends Component<Signature> {
  @tracked hasBlurredPaymentType = false;
  @tracked hasBlurredPayeeAddress = false;
  @tracked hasBlurredPaymentAmount = false;
  @tracked hasBlurredGasToken = false;
  @tracked hasBlurredMaxGasPrice = false;
  @service declare wallet: WalletService;

  get isPaymentTypeInvalid() {
    if (!this.hasBlurredPaymentType) {
      return false;
    }
    return this.args.isPaymentTypeInvalid;
  }

  get isPayeeAddressInvalid() {
    if (!this.hasBlurredPayeeAddress) {
      return false;
    }
    return this.args.isPayeeAddressInvalid;
  }

  get isPaymentAmountInvalid() {
    if (!this.hasBlurredPaymentAmount) {
      return false;
    }
    return this.args.isPaymentAmountInvalid;
  }

  get isGasTokenInvalid() {
    if (!this.hasBlurredGasToken) {
      return false;
    }
    return this.args.isGasTokenInvalid;
  }

  get isMaxGasPriceInvalid() {
    if (!this.hasBlurredMaxGasPrice) {
      return false;
    }
    return this.args.isMaxGasPriceInvalid;
  }

  get isFormInteractionDisabled() {
    if (!this.wallet.isConnected || this.args.isSafesEmpty) return true;

    return !!this.args.schedulingStatus || this.args.isSuccessfullyScheduled;
  }

  get actionChinState() {
    if (this.args.isSuccessfullyScheduled) {
      return 'memorialized';
    }
    if (this.args.schedulingStatus) {
      return 'in-progress';
    }
    return 'default';
  }

  <template>
    <BoxelActionContainer
      class="schedule-payment-form-action-card"
      data-test-schedule-payment-form-action-card
      ...attributes
    as |Section ActionChin|>
      <Section @title="Schedule Payment">
        <BoxelField @label="Frequency" class="schedule-payment-form-action-card__frequency">
          <div>
            <BoxelRadioInput
              @groupDescription="Select a type of scheduled payment"
              @name="payment-type"
              @errorMessage={{@paymentTypeErrorMessage}}
              @invalid={{this.isPaymentTypeInvalid}}
              @items={{@paymentTypeOptions}}
              @checkedId={{@selectedPaymentType}}
              @disabled={{this.isFormInteractionDisabled}}
              @onBlur={{set this 'hasBlurredPaymentType' true}}
            as |item|>
              {{#let item.component as |RadioItem|}}
                <RadioItem @onChange={{fn @onSelectPaymentType item.data.id}} data-test-payment-type={{item.data.id}}>
                  {{item.data.text}}
                </RadioItem>
              {{/let}}
            </BoxelRadioInput>
            {{#if @selectedPaymentType}}
              <fieldset class="schedule-payment-form-action-card__frequency-fieldset">
                {{!-- this div is necessary because Chrome has a special case for fieldsets and it breaks grid auto placement --}}
                <div class="schedule-payment-form-action-card__frequency-fieldset-container">
                  <div class="schedule-payment-form-action-card__when-fields">
                    {{#if (eq @selectedPaymentType 'one-time')}}
                      <BoxelField @label="Payment Date" @vertical={{true}} data-test-payment-date>
                        <BoxelInputDate
                          @value={{@paymentDate}}
                          @onChange={{@onSetPaymentDate}}
                          @minDate={{@minPaymentDate}}
                          @disabled={{this.isFormInteractionDisabled}}
                          data-test-input-payment-date
                        />
                      </BoxelField>
                      <BoxelField @label="Specific Time" @vertical={{true}} data-test-specific-payment-time>
                        <BoxelInputTime
                          @value={{@paymentDate}}
                          @onChange={{@onSetPaymentTime}}
                          @minValue={{@minPaymentTime}}
                          @disabled={{this.isFormInteractionDisabled}}
                          data-test-input-specific-payment-time
                        />
                      </BoxelField>
                    {{/if}}
                  </div>
                  <div class="schedule-payment-form-action-card__when-fields">
                    {{#if (eq @selectedPaymentType 'monthly')}}
                      <BoxelField @label="Day of Month" @vertical={{true}} data-test-recurring-day-of-month>
                        <RangedNumberPicker
                          @min={{1}}
                          @max={{31}}
                          @icon="calendar"
                          @onChange={{@onSelectPaymentDayOfMonth}}
                          @value={{@paymentDayOfMonth}}
                          @disabled={{this.isFormInteractionDisabled}}
                          data-test-input-recurring-day-of-month
                        />
                      </BoxelField>

                      <div class="schedule-payment-form-action-card__recurring-explanation">
                        {{svgJar "info" width="12px" height="12px"}}
                        <span> To perform payments on the last day of the month, choose 31st.</span>
                      </div>

                      <BoxelField @label="Until" @vertical={{true}} data-test-recurring-until>
                        <BoxelInputDate
                          @value={{@monthlyUntil}}
                          @onChange={{@onSetMonthlyUntil}}
                          @minDate={{@minMonthlyUntil}}
                          @disabled={{this.isFormInteractionDisabled}}
                          data-test-input-recurring-until
                        />
                      </BoxelField>
                    {{/if}}
                  </div>
                </div>
              </fieldset>
            {{/if}}
          </div>
        </BoxelField>
        <BoxelField @label="Recipient">
          <BoxelInput
            placeholder="Enter Address"
            data-test-payee-address-input
            @value={{@payeeAddress}}
            @invalid={{this.isPayeeAddressInvalid}}
            @errorMessage={{@payeeAddressErrorMessage}}
            @disabled={{this.isFormInteractionDisabled}}
            @onInput={{@onUpdatePayeeAddress}}
            @onBlur={{set this 'hasBlurredPayeeAddress' true}}
          />
        </BoxelField>
        <BoxelField @label="Amount">
          <BoxelInputSelectableTokenAmount
            data-test-amount-input
            @value={{@paymentAmountRaw}}
            @onInput={{@onUpdatePaymentAmount}}
            @invalid={{this.isPaymentAmountInvalid}}
            @errorMessage={{@paymentAmountErrorMessage}}
            @token={{@paymentToken}}
            @tokens={{@paymentTokens}}
            @disabled={{this.isFormInteractionDisabled}}
            @onChooseToken={{@onUpdatePaymentToken}}
            @onBlurToken={{set this 'hasBlurredPaymentAmount' true}}
          />
        </BoxelField>
        <BoxelField @label="Gas">
          <BoxelTokenSelect
            data-test-gas-token-select
            @placeholder="Choose a Gas Token"
            @invalid={{this.isGasTokenInvalid}}
            @errorMessage={{@gasTokenErrorMessage}}
            @value={{@selectedGasToken}}
            @tokens={{@gasTokens}}
            @disabled={{this.isFormInteractionDisabled}}
            @onChooseToken={{@onSelectGasToken}}
            @onBlur={{set this 'hasBlurredGasToken' true}}
          />
        </BoxelField>
        <BoxelField @label="Max Gas Cost">
          <BoxelToggleButtonGroup
            data-test-max-gas-toggle
            @groupDescription="The maximum gas cost you are willing to spend for this payment"
            @name="max-gas-fee"
            @errorMessage={{@maxGasPriceErrorMessage}}
            @invalid={{this.isMaxGasPriceInvalid}}
            @value={{@maxGasPrice}}
            @disabled={{this.isFormInteractionDisabled}}
            @onChange={{@onUpdateMaxGasPrice}}
            @onBlur={{set this 'hasBlurredMaxGasPrice' true}}
            as |group|
          >
            <group.Button @value="normal">
              <div class="schedule-payment-form-action-card--max-gas-fee-name">
                Normal
              </div>
              <div class="schedule-payment-form-action-card--max-gas-fee-description" data-test-max-gas-fee-normal-description>
                {{@maxGasDescriptions.normal}}
              </div>
            </group.Button>
            <group.Button @value="high">
              <div class="schedule-payment-form-action-card--max-gas-fee-name">
                High
              </div>
              <div class="schedule-payment-form-action-card--max-gas-fee-description" data-test-max-gas-fee-high-description>
                {{@maxGasDescriptions.high}}
              </div>
            </group.Button>
            <group.Button @value="max">
              <div class="schedule-payment-form-action-card--max-gas-fee-name">
                Max
              </div>
              <div class="schedule-payment-form-action-card--max-gas-fee-description" data-test-max-gas-fee-max-description>
                {{@maxGasDescriptions.max}}
              </div>
            </group.Button>
          </BoxelToggleButtonGroup>
          <div><!-- empty --></div>
          <div class="schedule-payment-form-action-card--fee-details">
            {{#if @configuredFees}}
              {{svgJar "info" width="17px" height="17px" class="schedule-payment-form-action-card--fee-info-icon"}}
              <span>Cardstack charges {{if @configuredFees.fixedUSD (formatUsd @configuredFees.fixedUSD)}} and {{@configuredFees.percentage}}% of the transaction as a fee for executing your scheduled payments.</span>
            {{/if}}
          </div>
        </BoxelField>
      </Section>
      <ActionChin @state={{this.actionChinState}}>
        <:default as |ac|>
          {{#if (and this.wallet.isConnected (not @isSafesEmpty))}}
            <ac.ActionButton
              @disabled={{not @isSubmitEnabled}}
              data-test-schedule-payment-form-submit-button
              {{on 'click' @onSchedulePayment}}
            >
              Schedule Payment
            </ac.ActionButton>
          {{else if (not this.wallet.isConnected)}}
            <div class="schedule-payment-form-prerequisite-step" data-test-schedule-form-connect-wallet-cta>
              <div class="schedule-payment-form-prerequisite-step__icons">
                {{svgJar
                  'wallet'
                  width="30px"
                  height="30px"
                  style=(cssVar
                    icon-color='var(--boxel-teal)'
                  )
                }}
                {{svgJar
                  'connect-arrows'
                  width="30px"
                  height="30px"
                }}
                {{svgJar
                  'cardstack'
                  width="30px"
                  height="30px"
                }}
              </div>
              <div class="schedule-payment-form-prerequisite-step__text">
                Step 1 - First connect your wallet
              </div>
            </div>
          {{else}}
            <div class="schedule-payment-form-prerequisite-step" data-test-schedule-form-connect-wallet-cta>
              <div class="schedule-payment-form-prerequisite-step__icons">
                {{svgJar
                  'network'
                  width="30px"
                  height="30px"
                  style=(cssVar
                    icon-color='var(--boxel-cyan)'
                  )
                }}
                {{svgJar
                  'plus'
                  width="16px"
                  height="30px"
                  style=(cssVar
                    icon-color='var(--boxel-yellow)'
                  )
                }}
                {{svgJar
                  'safe'
                  width="30px"
                  height="30px"
                  style=(cssVar
                    icon-color='var(--boxel-cyan)'
                  )
                }}
              </div>
              <div class="schedule-payment-form-prerequisite-step__text">
                Step 2 - Create a payments safe
              </div>
            </div>
          {{/if}}
        </:default>
        <:inProgress as |ac|>
          <ac.ActionStatusArea @icon={{concat @walletProviderId "-logo" }} style={{cssVar status-icon-size="2.5rem"}}>
            <BoxelLoadingIndicator
              class="schedule-payment-form-action-card__loading-indicator"
              @color="var(--boxel-light)"
            />
            <div class="schedule-payment-form-action-card__in-progress-message" data-test-in-progress-message>
              {{@schedulingStatus}}
            </div>
          </ac.ActionStatusArea>
          {{#if @txHash}}
            <ac.InfoArea>
              <BlockExplorerButton
                @networkSymbol={{@networkSymbol}}
                @transactionHash={{@txHash}}
                @kind="secondary-dark"
              />
            </ac.InfoArea>
          {{/if}}
        </:inProgress>
        <:memorialized as |ac|>
          <ac.ActionStatusArea data-test-memorialized-status>
            Payment was successfully scheduled
          </ac.ActionStatusArea>
          <ac.InfoArea>
            <BoxelButton
              @kind="secondary-light"
              data-test-schedule-payment-form-reset-button
              {{on 'click' @onReset}}
            >
              Schedule Another
            </BoxelButton>
          </ac.InfoArea>
        </:memorialized>
      </ActionChin>
    </BoxelActionContainer>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'SchedulePaymentFormActionCard::UI': typeof SchedulePaymentFormActionCardUI;
  }
}
