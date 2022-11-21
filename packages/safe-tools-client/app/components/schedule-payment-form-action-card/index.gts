import Component from '@glimmer/component';
import BoxelActionContainer from '@cardstack/boxel/components/boxel/action-container';
import BoxelField from '@cardstack/boxel/components/boxel/field';
import BoxelInputDate, { Day } from '@cardstack/boxel/components/boxel/input/date';
import BoxelInputTime, { Time } from '@cardstack/boxel/components/boxel/input/time';
import BoxelInput from '@cardstack/boxel/components/boxel/input';
import BoxelRadioInput from '@cardstack/boxel/components/boxel/radio-input';
import BoxelInputSelectableTokenAmount from '@cardstack/boxel/components/boxel/input/selectable-token-amount';
import RangedNumberPicker from '@cardstack/boxel/components/boxel/input/ranged-number-picker';
import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import BoxelTokenSelect from '@cardstack/boxel/components/boxel/input/token-select';
import BoxelToggleButtonGroup from '@cardstack/boxel/components/boxel/toggle-button-group';
import { inject as service } from '@ember/service';
import TokensService from '../../services/tokens';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import eq from 'ember-truth-helpers/helpers/eq';
import withTokenIcons from '../../helpers/with-token-icons';
import './index.css';

interface Signature {
  Element: HTMLElement;
}

export default class SchedulePaymentFormActionCard extends Component<Signature> {
  @service declare tokens: TokensService;
  get paymentTypeOptions() {
    return [
      { id: 'one-time', text: 'One-time payment' },
      { id: 'monthly', text: 'Monthly recurring' },
    ];
  }
  @tracked selectedPaymentType: string | undefined;
  @action onSelectPaymentType(paymentTypeId: string) {
    if (paymentTypeId === 'one-time' && !this.paymentDate) {
      this.paymentDate = new Date();
    }
    if (paymentTypeId === 'monthly') {
      if (!this.monthlyUntil) {
        let now = new Date();
        this.monthlyUntil = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      }
      if (!this.paymentDayOfMonth) {
        this.paymentDayOfMonth = 1;
      }
    }
    this.selectedPaymentType = paymentTypeId;
  }

  @tracked paymentDate: Date | undefined;
  @action onSetPaymentDate(day: Day) {
    this.paymentDate?.setFullYear(day.getFullYear(), day.getMonth(), day.getDate()); 
    this.paymentDate = new Date((day as Date).getTime()); // trigger reactivity
  }

  @action onSetPaymentTime(time: Time) {
    this.paymentDate?.setHours(time.getHours(), time.getMinutes());
    this.paymentDate = new Date((time as Date).getTime()); // trigger reactivity
  }

  @tracked monthlyUntil: Date | undefined;
  @action onSetMonthlyUntil(day: Day) {
    this.monthlyUntil?.setFullYear(day.getFullYear(), day.getMonth(), day.getDate()); 
    if (this.monthlyUntil) {
      this.monthlyUntil = new Date(this.monthlyUntil?.getTime()); // trigger reactivity
    }
  }

  @tracked paymentDayOfMonth: number | undefined;
  @action onSelectPaymentDayOfMonth(val: number) {
    this.paymentDayOfMonth = val;
  }

  @tracked recipientAddress = '';
  @tracked isRecipientAddressInvalid = false;
  @tracked recipientAddressErrorMessage = '';

  @tracked paymentAmount: string = '';
  @tracked isPaymentAmountInvalid = false;
  @tracked paymentTokenErrorMessage = '';

  paymentTokens: SelectableToken[] = [
    { name: 'CARD', logoURI: 'card', symbol: 'CARD', address: '0x0111111111' },
    { name: 'HI', logoURI: 'emoji', symbol: 'CARD', address: '0x0111111111' },
    { name: 'WORLD', logoURI: 'world', symbol: 'CARD', address: '0x0111111111' },
  ];
  @tracked paymentToken: SelectableToken = this.paymentTokens[0];

  @action onUpdatePaymentAmount(val: string) {
    this.paymentAmount = val;
  }
  @action onUpdatePaymentToken(val: SelectableToken) {
    this.paymentToken = val;
  }

  @tracked selectedGasToken: SelectableToken | undefined;
  @action onSelectGasToken(val: SelectableToken) {
    this.selectedGasToken = val;
  }

  @tracked maxGasFee: string | undefined;
  @action onUpdateMaxGasFee(val: string) {
    this.maxGasFee = val;
  }

  @action
  schedulePayment() {
    console.log('TODO...');
  }

  <template>
    <BoxelActionContainer
      class="schedule-payment-form-action-card"
      ...attributes
    as |Section ActionChin|>
      <Section @title="Schedule Payment">
        <BoxelField @label="Frequency" class="schedule-payment-form-action-card__frequency">
          <div>
            <BoxelRadioInput
              @groupDescription="Select a type of scheduled payment"
              @name="payment-type"
              @items={{this.paymentTypeOptions}}
              @checkedId={{this.selectedPaymentType}}
            as |item|>
              <item.component @onChange={{fn this.onSelectPaymentType item.data.id}}>
                {{item.data.text}}
              </item.component>
            </BoxelRadioInput>
            {{#if this.selectedPaymentType}}
              <fieldset class="schedule-payment-form-action-card__frequency-fieldset">
                {{!-- this div is necessary because Chrome has a special case for fieldsets and it breaks grid auto placement --}}
                <div class="schedule-payment-form-action-card__frequency-fieldset-container">
                  <div class="schedule-payment-form-action-card__when-fields">
                    {{#if (eq this.selectedPaymentType 'one-time')}}
                      <BoxelField @label="Payment Date" @vertical={{true}}>
                        <BoxelInputDate
                          @value={{this.paymentDate}}
                          @onChange={{this.onSetPaymentDate}}
                        />
                      </BoxelField>
                      <BoxelField @label="Specific Time" @vertical={{true}}>
                        <BoxelInputTime
                          @value={{this.paymentDate}}
                          @onChange={{this.onSetPaymentTime}}
                        />
                      </BoxelField>
                    {{/if}}
                  </div>
                  <div class="schedule-payment-form-action-card__when-fields">
                    {{#if (eq this.selectedPaymentType 'monthly')}}
                      <BoxelField @label="Day of Month" @vertical={{true}}>
                        <RangedNumberPicker
                          @min={{1}}
                          @max={{28}}
                          @icon="calendar"
                          @onChange={{this.onSelectPaymentDayOfMonth}}
                          @value={{this.paymentDayOfMonth}}
                        />
                      </BoxelField>
                      <BoxelField @label="Until" @vertical={{true}}>
                        <BoxelInputDate
                          @value={{this.monthlyUntil}}
                          @onChange={{this.onSetMonthlyUntil}}
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
            @value={{this.recipientAddress}}
            @invalid={{this.isRecipientAddressInvalid}}
            @errorMessage={{this.recipientAddressErrorMessage}}
          />
        </BoxelField>
        <BoxelField @label="Amount">
          <BoxelInputSelectableTokenAmount
            @value={{this.paymentAmount}}
            @onInput={{this.onUpdatePaymentAmount}}
            @invalid={{this.isPaymentAmountInvalid}}
            @errorMessage={{this.paymentTokenErrorMessage}}
            @token={{this.paymentToken}}
            @tokens={{this.paymentTokens}}
            @onChooseToken={{this.onUpdatePaymentToken}}
          />
        </BoxelField>
        <BoxelField @label="Gas">
          <BoxelTokenSelect
            @placeholder="Choose a Gas Token"
            @value={{this.selectedGasToken}}
            @onChooseToken={{this.onSelectGasToken}}
            @tokens={{withTokenIcons this.tokens.gasTokens.value}}
          />
        </BoxelField>
        <BoxelField @label="Max Gas Fee">
          <BoxelToggleButtonGroup
            @groupDescription="The maximum gas fee you are willing to spend for this payment"
            @name="max-gas-fee"
            @value={{this.maxGasFee}}
            @onChange={{this.onUpdateMaxGasFee}} as |group|
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
              {{on 'click' this.schedulePayment}}
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
    'SchedulePaymentFormActionCard': typeof SchedulePaymentFormActionCard;
  }
}
