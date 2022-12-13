import Component from '@glimmer/component';
import SchedulePaymentFormActionCardUI from './ui';
import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import { inject as service } from '@ember/service';
import TokensService from '../../services/tokens';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { Day } from '@cardstack/boxel/components/boxel/input/date';
import { Time } from '@cardstack/boxel/components/boxel/input/time';
import withTokenIcons from '../../helpers/with-token-icons';
import SchedulePaymentFormValidator, { ValidatableForm } from './validator';
import not from 'ember-truth-helpers/helpers/not';

interface Signature {
  Element: HTMLElement;
}

export default class SchedulePaymentFormActionCard extends Component<Signature> implements ValidatableForm {
  @service declare tokens: TokensService;
  validator = new SchedulePaymentFormValidator(this);

  get paymentTypeOptions() {
    return [
      { id: 'one-time', text: 'One-time payment' },
      { id: 'monthly', text: 'Monthly recurring' },
    ];
  }
  
  get minPaymentDate() {
    let now = new Date();
    return new Date(now.setHours(now.getHours() + 1, 0, 0, 0));
  }

  @tracked selectedPaymentType: 'one-time' | 'monthly' | undefined;
  @action onSelectPaymentType(paymentTypeId: string) {
    if (paymentTypeId === 'one-time') {
      if (!this.paymentDate) {
        this.paymentDate = this.minPaymentDate;
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
    let selectedDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), this.paymentDate?.getHours(), this.paymentDate?.getMinutes());
    if (selectedDate < this.minPaymentDate) {
      this.paymentDate = this.minPaymentDate;
    } else {
      this.paymentDate = selectedDate;
    }
  }

  @action onSetPaymentTime(time: Time) {
    this.paymentDate?.setHours(time.getHours(), time.getMinutes());
    this.paymentDate = new Date((time as Date).getTime()); // trigger reactivity
  }

  get minPaymentTime() {
    let minPaymentTime;
    if (this.paymentDate && this.paymentDate.getDate() > this.minPaymentDate.getDate()) {
      minPaymentTime = new Date(this.minPaymentDate.getFullYear(), this.minPaymentDate.getMonth(), this.minPaymentDate.getDate(), 0, 0, 0, 0)
    } else {
      minPaymentTime = this.minPaymentDate;
    }
    return minPaymentTime;
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

    if (this.monthlyUntil && this.monthlyUntil < this.minMonthlyUntil) {
      this.monthlyUntil = this.minMonthlyUntil;
    }
  }

  get minMonthlyUntil() {
    let minMonthlyUntil;
    let now = new Date();

    if (this.paymentDayOfMonth && this.paymentDayOfMonth < now.getDate()) {
      minMonthlyUntil = new Date(now.getFullYear(), now.getMonth() + 1, this.paymentDayOfMonth);
    } else {
      minMonthlyUntil = now;
    }

    return minMonthlyUntil;
  }

  @tracked recipientAddress = '';
  @action onUpdateRecipientAddress(val: string) {
    this.recipientAddress = val;
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

  @tracked maxGasFee: 'normal' | 'high' | 'max' | undefined;
  @action onUpdateMaxGasFee(val: 'normal' | 'high' | 'max') {
    this.maxGasFee = val;
  }

  get isValid(): boolean {
    return this.validator.isValid;
  }

  @action
  schedulePayment() {
    console.log('TODO...');
  }

  <template>
    <SchedulePaymentFormActionCardUI
      @paymentTypeOptions={{this.paymentTypeOptions}}
      @selectedPaymentType={{this.selectedPaymentType}}
      @onSelectPaymentType={{this.onSelectPaymentType}}
      @isPaymentTypeInvalid={{not this.validator.isPaymentTypeValid}}
      @paymentTypeErrorMessage={{this.validator.paymentTypeErrorMessage}}
      @minPaymentDate={{this.minPaymentDate}}
      @minPaymentTime={{this.minPaymentTime}}
      @paymentDate={{this.paymentDate}}
      @onSetPaymentTime={{this.onSetPaymentTime}}
      @onSetPaymentDate={{this.onSetPaymentDate}}
      @paymentDayOfMonth={{this.paymentDayOfMonth}}
      @onSelectPaymentDayOfMonth={{this.onSelectPaymentDayOfMonth}}
      @minMonthlyUntil={{this.minMonthlyUntil}}
      @monthlyUntil={{this.monthlyUntil}}
      @onSetMonthlyUntil={{this.onSetMonthlyUntil}}
      @recipientAddress={{this.recipientAddress}}
      @isRecipientAddressInvalid={{not this.validator.isRecipientAddressValid}}
      @recipientAddressErrorMessage={{this.validator.recipientAddressErrorMessage}}
      @onUpdateRecipientAddress={{this.onUpdateRecipientAddress}}
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
      @maxGasFee={{this.maxGasFee}}
      @onUpdateMaxGasFee={{this.onUpdateMaxGasFee}}
      @isMaxGasFeeInvalid={{not this.validator.isMaxGasFeeValid}}
      @maxGasFeeErrorMessage={{this.validator.maxGasFeeErrorMessage}}
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
