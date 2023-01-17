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
import tokenToUsd from '@cardstack/safe-tools-client/helpers/token-to-usd';
import { type CurrentFees } from '../fee-calculator';
import TokenQuantity from '@cardstack/safe-tools-client/utils/token-quantity';

interface Signature {
  Element: HTMLElement;
  Args: ValidatableForm & {
    configuredFees: ConfiguredScheduledPaymentFees | undefined;
    currentFees: CurrentFees | undefined;
    gasTokenErrorMessage: string;
    gasTokens: SelectableToken[];
    isGasTokenInvalid: boolean;
    isMaxGasPriceInvalid: boolean;
    isPayeeAddressInvalid: boolean;
    isPaymentAmountInvalid: boolean;
    isPaymentTypeInvalid: boolean;
    isSuccessfullyScheduled: boolean;
    isValid: boolean;
    maxGasDescriptions?: Record<MaxGasFeeOption, string>;
    maxGasPriceErrorMessage: string;
    networkSymbol: SchedulerCapableNetworks;
    onReset: () => void;
    onSchedulePayment: () => void;
    onSelectGasToken: (val: SelectableToken) => void;
    onSelectPaymentDayOfMonth: (val: number) => void;
    onSelectPaymentType: (paymentTypeId: string) => void;
    onSetMonthlyUntil: (date: Date) => void;
    onSetPaymentDate: (day: Day) => void;
    onSetPaymentTime: (time: Time) => void;
    onUpdateMaxGasPrice: (val: string) => void;
    onUpdatePayeeAddress: (val: string) => void;
    onUpdatePaymentAmount: (val: string) => void;
    onUpdatePaymentToken: (val: SelectableToken) => void;
    payeeAddressErrorMessage: string;
    paymentAmountErrorMessage: string;
    paymentTokens: SelectableToken[];
    paymentAmountTokenQuantity: TokenQuantity | undefined;
    paymentTypeErrorMessage: string;
    paymentTypeOptions: { id: string, text: string }[];
    schedulingStatus: string | undefined;
    txHash: TransactionHash | undefined;
    walletProviderId: WalletProviderId | undefined;
  }
}

export default class SchedulePaymentFormActionCardUI extends Component<Signature> {
  @tracked hasBlurredPaymentType = false;
  @tracked hasBlurredPayeeAddress = false;
  @tracked hasBlurredPaymentAmount = false;
  @tracked hasBlurredGasToken = false;
  @tracked hasBlurredMaxGasPrice = false;

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
              <div class="schedule-payment-form-action-card__max-gas-fee-name">
                Normal
              </div>
              <div class="schedule-payment-form-action-card__max-gas-fee-description" data-test-max-gas-fee-normal-description>
                {{@maxGasDescriptions.normal}}
              </div>
            </group.Button>
            <group.Button @value="high">
              <div class="schedule-payment-form-action-card__max-gas-fee-name">
                High
              </div>
              <div class="schedule-payment-form-action-card__max-gas-fee-description" data-test-max-gas-fee-high-description>
                {{@maxGasDescriptions.high}}
              </div>
            </group.Button>
            <group.Button @value="max">
              <div class="schedule-payment-form-action-card__max-gas-fee-name">
                Max
              </div>
              <div class="schedule-payment-form-action-card__max-gas-fee-description" data-test-max-gas-fee-max-description>
                {{@maxGasDescriptions.max}}
              </div>
            </group.Button>
          </BoxelToggleButtonGroup>
          <div><!-- empty --></div>
          <div class="schedule-payment-form-action-card__fee-details">
            {{#if @configuredFees}}
              {{svgJar "info" width="17px" height="17px" class="schedule-payment-form-action-card__fee-info-icon"}}
              <span>Cardstack charges {{if @configuredFees.fixedUSD (formatUsd @configuredFees.fixedUSD)}} and {{@configuredFees.percentage}}% of the transaction as a fee for executing your scheduled payments.</span>
            {{/if}}
          </div>
        </BoxelField>
        {{#if @isValid}}
          <BoxelField @label="Execution Plan" style={{cssVar boxel-field-label-align="top"}}>
            <div>
              <BoxelField @label="Recipient Will Receive" data-test-summary-recipient-receives @vertical={{true}} style={{cssVar boxel-field-label-justify-content="end"}}>
                <div class="schedule-payment-form-action-card__fees-value">
                  {{#if @paymentAmountTokenQuantity}}
                    <div>{{@paymentAmountTokenQuantity.displayable}}</div>
                    <div class="schedule-payment-form-action-card__fee-usd-estimate">{{tokenToUsd tokenQuantity=@paymentAmountTokenQuantity}}</div>
                  {{/if}}
                </div>
              </BoxelField>
              <BoxelField @label="Fixed Fee" data-test-summary-fixed-fee @vertical={{true}} style={{cssVar boxel-field-label-justify-content="end"}}>
                <div class="schedule-payment-form-action-card__fees-value">
                  {{#if @currentFees.fixedFee}}
                    <div>{{@currentFees.fixedFee.displayable}}</div>
                    <div class="schedule-payment-form-action-card__fee-usd-estimate">{{tokenToUsd tokenQuantity=@currentFees.fixedFee}}</div>
                  {{/if}}
                </div>
              </BoxelField>
              <BoxelField @label="Variable Fee" data-test-summary-variable-fee @vertical={{true}} style={{cssVar boxel-field-label-justify-content="end"}}>
                <div class="schedule-payment-form-action-card__fees-value">
                  {{#if @currentFees.variableFee}}
                    <div>{{@currentFees.variableFee.displayable}}</div>
                    <div class="schedule-payment-form-action-card__fee-usd-estimate">{{tokenToUsd tokenQuantity=@currentFees.variableFee}}</div>
                  {{/if}}
                </div>
              </BoxelField>
            </div>
          </BoxelField>
        {{/if}}
      </Section>
      <ActionChin @state={{this.actionChinState}}>
        <:default as |ac|>
          <ac.ActionButton
            @disabled={{not @isValid}}
            data-test-schedule-payment-form-submit-button
            {{on 'click' @onSchedulePayment}}
          >
            Schedule Payment
          </ac.ActionButton>
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
