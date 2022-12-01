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
import eq from 'ember-truth-helpers/helpers/eq';
import not from 'ember-truth-helpers/helpers/not';
import './index.css';
import { MaxGasFeeOption, ValidatableForm } from '../validator';

interface Signature {
  Element: HTMLElement;
  Args: ValidatableForm & {
    paymentTypeOptions: { id: string, text: string }[];
    onSelectPaymentType: (paymentTypeId: string) => void;
    onSetPaymentDate: (day: Day) => void;
    onSetPaymentTime: (time: Time) => void;
    onSelectPaymentDayOfMonth: (val: number) => void;
    onSetMonthlyUntil: (date: Date) => void;
    isRecipientAddressInvalid: boolean;
    recipientAddressErrorMessage: string;
    onUpdatePaymentAmount: (val: string) => void;
    isPaymentAmountInvalid: boolean;
    paymentTokenErrorMessage: string;
    paymentTokens: SelectableToken[];
    onUpdatePaymentToken: (val: SelectableToken) => void;
    gasTokens: SelectableToken[];
    onSelectGasToken: (val: SelectableToken) => void;
    onUpdateMaxGasFee: (val: string) => void;
    maxGasDescriptions?: Record<MaxGasFeeOption, string>;
    onSchedulePayment: () => void;
    isSubmitEnabled: boolean;
    onUpdateRecipientAddress: (val: string) => void;
  }
}

export default class SchedulePaymentFormActionCardUI extends Component<Signature> {
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
              @items={{@paymentTypeOptions}}
              @checkedId={{@selectedPaymentType}}
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
                      <BoxelField @label="Payment Date" @vertical={{true}}>
                        <BoxelInputDate
                          @value={{@paymentDate}}
                          @onChange={{@onSetPaymentDate}}
                        />
                      </BoxelField>
                      <BoxelField @label="Specific Time" @vertical={{true}}>
                        <BoxelInputTime
                          @value={{@paymentDate}}
                          @onChange={{@onSetPaymentTime}}
                        />
                      </BoxelField>
                    {{/if}}
                  </div>
                  <div class="schedule-payment-form-action-card__when-fields">
                    {{#if (eq @selectedPaymentType 'monthly')}}
                      <BoxelField @label="Day of Month" @vertical={{true}}>
                        <RangedNumberPicker
                          @min={{1}}
                          @max={{28}}
                          @icon="calendar"
                          @onChange={{@onSelectPaymentDayOfMonth}}
                          @value={{@paymentDayOfMonth}}
                        />
                      </BoxelField>
                      <BoxelField @label="Until" @vertical={{true}}>
                        <BoxelInputDate
                          @value={{@monthlyUntil}}
                          @onChange={{@onSetMonthlyUntil}}
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
            data-test-recipient-address-input
            @value={{@recipientAddress}}
            @invalid={{@isRecipientAddressInvalid}}
            @errorMessage={{@recipientAddressErrorMessage}}
            @onInput={{@onUpdateRecipientAddress}}
          />
        </BoxelField>
        <BoxelField @label="Amount">
          <BoxelInputSelectableTokenAmount
            data-test-amount-input
            @value={{@paymentAmount}}
            @onInput={{@onUpdatePaymentAmount}}
            @invalid={{@isPaymentAmountInvalid}}
            @errorMessage={{@paymentTokenErrorMessage}}
            @token={{@paymentToken}}
            @tokens={{@paymentTokens}}
            @onChooseToken={{@onUpdatePaymentToken}}
          />
        </BoxelField>
        <BoxelField @label="Gas">
          <BoxelTokenSelect
            data-test-gas-token-select
            @placeholder="Choose a Gas Token"
            @value={{@selectedGasToken}}
            @onChooseToken={{@onSelectGasToken}}
            @tokens={{@gasTokens}}
          />
        </BoxelField>
        <BoxelField @label="Max Gas Fee">
          <BoxelToggleButtonGroup
            data-test-max-gas-toggle
            @groupDescription="The maximum gas fee you are willing to spend for this payment"
            @name="max-gas-fee"
            @value={{@maxGasFee}}
            @onChange={{@onUpdateMaxGasFee}} as |group|
          >
            <group.Button @value="normal">
              <div class="schedule-payment-form-action-card--max-gas-fee-name">
                Normal
              </div>
              <div class="schedule-payment-form-action-card--max-gas-fee-description">
                {{@maxGasDescriptions.normal}}
              </div>
            </group.Button>
            <group.Button @value="high">
              <div class="schedule-payment-form-action-card--max-gas-fee-name">
                High
              </div>
              <div class="schedule-payment-form-action-card--max-gas-fee-description">
                {{@maxGasDescriptions.high}}
              </div>
            </group.Button>
            <group.Button @value="max">
              <div class="schedule-payment-form-action-card--max-gas-fee-name">
                Max
              </div>
              <div class="schedule-payment-form-action-card--max-gas-fee-description">
                {{@maxGasDescriptions.max}}
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
