import Component from '@glimmer/component';
import SchedulePaymentFormActionCardUI from './ui';
import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import { inject as service } from '@ember/service';
import SafesService from '../../services/safes';
import ScheduledPaymentsSdkService from '../../services/scheduled-payments-sdk';
import TokensService from '../../services/tokens';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { Day } from '@cardstack/boxel/components/boxel/input/date';
import { Time } from '@cardstack/boxel/components/boxel/input/time';
import withTokenIcons from '../../helpers/with-token-icons';
import SchedulePaymentFormValidator, { ValidatableForm } from './validator';
import not from 'ember-truth-helpers/helpers/not';
import { convertAmountToRawAmount } from '@cardstack/cardpay-sdk';
import { taskFor } from 'ember-concurrency-ts';

interface Signature {
  Element: HTMLElement;
}

export default class SchedulePaymentFormActionCard extends Component<Signature> implements ValidatableForm {
  @service declare safes: SafesService;
  @service declare tokens: TokensService;
  @service declare scheduledPaymentsSdk: ScheduledPaymentsSdkService;
  validator = new SchedulePaymentFormValidator(this);
  executionGas = 1000; // TODO: this should be set by code that populates Max Gas Options

  get paymentTypeOptions() {
    return [
      { id: 'one-time', text: 'One-time payment' },
      { id: 'monthly', text: 'Monthly recurring' },
    ];
  }
  @tracked selectedPaymentType: 'one-time' | 'monthly' | undefined;
  @action onSelectPaymentType(paymentTypeId: string) {
    if (paymentTypeId === 'one-time') {
      if (!this.paymentDate) {
        this.paymentDate = new Date();
      }
      
      this.selectedPaymentType = paymentTypeId;
    }
    if (paymentTypeId === 'monthly') {
      if (!this.monthlyUntil) {
        let now = new Date();
        this.monthlyUntil = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      }
      if (!this.paymentDayOfMonth) {
        this.paymentDayOfMonth = 1;
      }
      this.selectedPaymentType = paymentTypeId;
    }
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
  @action onSetMonthlyUntil(date: Date) {
    this.monthlyUntil?.setFullYear(date.getFullYear(), date.getMonth(), date.getDate()); 
    if (this.monthlyUntil) {
      this.monthlyUntil = new Date(this.monthlyUntil?.getTime()); // trigger reactivity
    }
  }

  @tracked paymentDayOfMonth: number | undefined;
  @action onSelectPaymentDayOfMonth(val: number) {
    this.paymentDayOfMonth = val;
  }

  @tracked payeeAddress = '';
  @action onUpdatePayeeAddress(val: string) {
    this.payeeAddress = val;
  }

  @tracked paymentAmount: string = '';

  get paymentTokens(): SelectableToken[] {
    return this.tokens.transactionTokens;
  }
  @tracked paymentToken: SelectableToken | undefined;

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

  @tracked maxGasPrice: 'normal' | 'high' | 'max' | undefined;
  @action onUpdateMaxGasPrice(val: 'normal' | 'high' | 'max') {
    this.maxGasPrice = val;
  }

  get isValid(): boolean {
    return this.validator.isValid;
  }

  @action
  async schedulePayment() {
    let { currentSafe } = this.safes;
    if (!currentSafe) return;
    if (!this.paymentDate) return;
    if (!this.paymentToken) return;
    if (!this.selectedGasToken) return;

    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    const salt = btoa(String.fromCharCode.apply(null, array));

    await taskFor(this.scheduledPaymentsSdk.schedulePayment).perform(
      currentSafe.address,
      currentSafe.spModuleAddress,
      this.paymentToken.address,
      convertAmountToRawAmount(this.paymentAmount, this.paymentToken.decimals),
      this.payeeAddress,
      this.executionGas,
      '15000000000', // TODO: this.maxGasPrice,
      this.selectedGasToken.address,
      salt,
      Math.round(this.paymentDate.getTime() / 1000),
      null, //TODO: support for recurringDayOfMonth
      null, //TODO: support for recurringUntil
      (scheduledPaymentId: string) => {
        console.log(`Scheduled payment created in the crank: ${scheduledPaymentId}.`);
        console.log('Waiting for the transaction to be mined...');
      }
    )
  }

  <template>
    <SchedulePaymentFormActionCardUI
      @paymentTypeOptions={{this.paymentTypeOptions}}
      @selectedPaymentType={{this.selectedPaymentType}}
      @onSelectPaymentType={{this.onSelectPaymentType}}
      @isPaymentTypeInvalid={{not this.validator.isPaymentTypeValid}}
      @paymentTypeErrorMessage={{this.validator.paymentTypeErrorMessage}}
      @paymentDate={{this.paymentDate}}
      @onSetPaymentTime={{this.onSetPaymentTime}}
      @onSetPaymentDate={{this.onSetPaymentDate}}
      @paymentDayOfMonth={{this.paymentDayOfMonth}}
      @onSelectPaymentDayOfMonth={{this.onSelectPaymentDayOfMonth}}
      @monthlyUntil={{this.monthlyUntil}}
      @onSetMonthlyUntil={{this.onSetMonthlyUntil}}
      @payeeAddress={{this.payeeAddress}}
      @isPayeeAddressInvalid={{not this.validator.isPayeeAddressValid}}
      @payeeAddressErrorMessage={{this.validator.payeeAddressErrorMessage}}
      @onUpdatePayeeAddress={{this.onUpdatePayeeAddress}}
      @paymentAmount={{this.paymentAmount}}
      @onUpdatePaymentAmount={{this.onUpdatePaymentAmount}}
      @isPaymentAmountInvalid={{not this.validator.isAmountValid}}
      @paymentAmountErrorMessage={{this.validator.amountErrorMessage}}
      @paymentToken={{this.paymentToken}}
      @paymentTokens={{this.paymentTokens}}
      @onUpdatePaymentToken={{this.onUpdatePaymentToken}}
      @selectedGasToken={{this.selectedGasToken}}
      @gasTokens={{withTokenIcons this.tokens.gasTokens.value}}
      @onSelectGasToken={{this.onSelectGasToken}}
      @isGasTokenInvalid={{not this.validator.isGasTokenValid}}
      @gasTokenErrorMessage={{this.validator.gasTokenErrorMessage}}
      @maxGasPrice={{this.maxGasPrice}}
      @onUpdateMaxGasPrice={{this.onUpdateMaxGasPrice}}
      @isMaxGasPriceInvalid={{not this.validator.isMaxGasPriceValid}}
      @maxGasPriceErrorMessage={{this.validator.maxGasPriceErrorMessage}}
      @onSchedulePayment={{this.schedulePayment}}
      @isSubmitEnabled={{this.isValid}}
    />
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'SchedulePaymentFormActionCard': typeof SchedulePaymentFormActionCard;
  }
}
