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

  @tracked recipientAddress = '';
  @tracked isRecipientAddressInvalid = false;
  @tracked recipientAddressErrorMessage = '';

  @tracked paymentAmount: string = '';
  @tracked isPaymentAmountInvalid = false;
  @tracked paymentTokenErrorMessage = '';

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

  @tracked maxGasFee: string | undefined;
  @action onUpdateMaxGasFee(val: string) {
    this.maxGasFee = val;
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
      @paymentDate={{this.paymentDate}}
      @onSetPaymentTime={{this.onSetPaymentTime}}
      @onSetPaymentDate={{this.onSetPaymentDate}}
      @paymentDayOfMonth={{this.paymentDayOfMonth}}
      @onSelectPaymentDayOfMonth={{this.onSelectPaymentDayOfMonth}}
      @monthlyUntil={{this.monthlyUntil}}
      @onSetMonthlyUntil={{this.onSetMonthlyUntil}}
      @recipientAddress={{this.recipientAddress}}
      @isRecipientAddressInvalid={{this.isRecipientAddressInvalid}}
      @recipientAddressErrorMessage={{this.recipientAddressErrorMessage}}
      @paymentAmount={{this.paymentAmount}}
      @onUpdatePaymentAmount={{this.onUpdatePaymentAmount}}
      @isPaymentAmountInvalid={{this.isPaymentAmountInvalid}}
      @paymentTokenErrorMessage={{this.paymentTokenErrorMessage}}
      @paymentToken={{this.paymentToken}}
      @paymentTokens={{this.paymentTokens}}
      @onUpdatePaymentToken={{this.onUpdatePaymentToken}}
      @selectedGasToken={{this.selectedGasToken}}
      @gasTokens={{withTokenIcons this.tokens.gasTokens.value}}
      @onSelectGasToken={{this.onSelectGasToken}}
      @maxGasFee={{this.maxGasFee}}
      @onUpdateMaxGasFee={{this.onUpdateMaxGasFee}}
      @onSchedulePayment={{this.schedulePayment}}
    />
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'SchedulePaymentFormActionCard': typeof SchedulePaymentFormActionCard;
  }
}
