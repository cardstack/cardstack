import Component from '@glimmer/component';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container';
import BoxelField from '@cardstack/boxel/components/boxel/field';
import BoxelInputDate, { Day } from '@cardstack/boxel/components/boxel/input/date';
import BoxelInputTime, { Time } from '@cardstack/boxel/components/boxel/input/time';
import BoxelInput from '@cardstack/boxel/components/boxel/input';
import BoxelRadioInput from '@cardstack/boxel/components/boxel/radio-input';
import BoxelInputSelectableTokenAmount from '@cardstack/boxel/components/boxel/input/selectable-token-amount';
import RangedNumberPicker from '@cardstack/boxel/components/boxel/input/ranged-number-picker';
import BoxelTokenSelect from '@cardstack/boxel/components/boxel/input/token-select';
import BoxelToggleButtonGroup from '@cardstack/boxel/components/boxel/toggle-button-group';
import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import { tracked } from '@glimmer/tracking';
import eq from 'ember-truth-helpers/helpers/eq';
import not from 'ember-truth-helpers/helpers/not';
import set from 'ember-set-helper/helpers/set';
import './index.css';
import { ValidatableForm } from '../validator';

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
    isGasTokenInvalid: boolean;
    gasTokenErrorMessage: string;
    onUpdateMaxGasPrice: (val: string) => void;
    isMaxGasPriceInvalid: boolean;
    maxGasPriceErrorMessage: string;
    onSchedulePayment: () => void;
    isSubmitEnabled: boolean;
    onUpdatePayeeAddress: (val: string) => void;
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
                          data-test-input-payment-date
                        />
                      </BoxelField>
                      <BoxelField @label="Specific Time" @vertical={{true}} data-test-specific-payment-time>
                        <BoxelInputTime
                          @value={{@paymentDate}}
                          @onChange={{@onSetPaymentTime}}
                          @minValue={{@minPaymentTime}}
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
                          @max={{28}}
                          @icon="calendar"
                          @onChange={{@onSelectPaymentDayOfMonth}}
                          @value={{@paymentDayOfMonth}}
                          data-test-input-recurring-day-of-month
                        />
                      </BoxelField>
                      <BoxelField @label="Until" @vertical={{true}} data-test-recurring-until>
                        <BoxelInputDate
                          @value={{@monthlyUntil}}
                          @onChange={{@onSetMonthlyUntil}}
                          @minDate={{@minMonthlyUntil}}
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
            @onInput={{@onUpdatePayeeAddress}}
            @onBlur={{set this 'hasBlurredPayeeAddress' true}}
          />
        </BoxelField>
        <BoxelField @label="Amount">
          <BoxelInputSelectableTokenAmount
            data-test-amount-input
            @value={{@paymentAmount}}
            @onInput={{@onUpdatePaymentAmount}}
            @invalid={{this.isPaymentAmountInvalid}}
            @errorMessage={{@paymentAmountErrorMessage}}
            @token={{@paymentToken}}
            @tokens={{@paymentTokens}}
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
            @onChooseToken={{@onSelectGasToken}}
            @onBlur={{set this 'hasBlurredGasToken' true}}
          />
        </BoxelField>
        <BoxelField @label="Max Gas Fee">
          <BoxelToggleButtonGroup
            data-test-max-gas-toggle
            @groupDescription="The maximum gas fee you are willing to spend for this payment"
            @name="max-gas-fee"
            @errorMessage={{@maxGasPriceErrorMessage}}
            @invalid={{this.isMaxGasPriceInvalid}}
            @value={{@maxGasPrice}}
            @onChange={{@onUpdateMaxGasPrice}}
            @onBlur={{set this 'hasBlurredMaxGasPrice' true}}
            as |group|
          >
            <group.Button @value="normal">
              <div class="schedule-payment-form-action-card--max-gas-fee-name">
                Normal
              </div>
              <div class="schedule-payment-form-action-card--max-gas-fee-description">
                Less than $0.10 USD
              </div>
            </group.Button>
            <group.Button @value="high">
              <div class="schedule-payment-form-action-card--max-gas-fee-name">
                High
              </div>
              <div class="schedule-payment-form-action-card--max-gas-fee-description">
                Less than $1.00 USD
              </div>
            </group.Button>
            <group.Button @value="max">
              <div class="schedule-payment-form-action-card--max-gas-fee-name">
                Max
              </div>
              <div class="schedule-payment-form-action-card--max-gas-fee-description">
                Capped at $10 USD
              </div>
            </group.Button>
          </BoxelToggleButtonGroup>
          <div><!-- empty --></div>
          <div class="schedule-payment-form-action-card--fee-details">
            {{svgJar "info" width="17px" height="17px" class="schedule-payment-form-action-card--fee-info-icon"}}
            <span>Cardstack charges $0.25 USD and 0.1% of the transaction as a fee for executing your scheduled payments.</span>
          </div>
        </BoxelField>
      </Section>
        <ActionChin @state='default'>
          <:default as |ac|>
            <ac.ActionButton
              @disabled={{not @isSubmitEnabled}}
              data-test-schedule-payment-form-submit-button
              {{on 'click' @onSchedulePayment}}
            >
              Schedule Payment
            </ac.ActionButton>
          </:default>
        </ActionChin>
    </BoxelActionContainer>    
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'SchedulePaymentFormActionCard::UI': typeof SchedulePaymentFormActionCardUI;
  }
}
