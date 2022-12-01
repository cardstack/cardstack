import Component from '@glimmer/component';
import SchedulePaymentFormActionCardUI from './ui';
import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import { inject as service } from '@ember/service';
import NetworkService from '../../services/network';
import TokensService from '../../services/tokens';
import ScheduledPaymentsSDKService from '../../services/scheduled-payments-sdk';
import WalletService from '../../services/wallet';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { Day } from '@cardstack/boxel/components/boxel/input/date';
import { Time } from '@cardstack/boxel/components/boxel/input/time';
import withTokenIcons from '../../helpers/with-token-icons';
import SchedulePaymentFormValidator, { MaxGasFeeOption, ValidatableForm } from './validator';
import { use, resource } from 'ember-resources';
import { TrackedObject } from 'tracked-built-ins';
import { fromWei } from 'web3-utils';

interface Signature {
  Element: HTMLElement;
}
interface MaxGasDescriptionsState {
  isLoading: boolean;
  isIndeterminate: boolean;
  value?: Record<MaxGasFeeOption, string>
  error?: Error
}

export default class SchedulePaymentFormActionCard extends Component<Signature> implements ValidatableForm {
  @service declare network: NetworkService;
  @service declare scheduledPaymentsSDK: ScheduledPaymentsSDKService;
  @service declare tokens: TokensService;
  @service declare wallet: WalletService;
  validator = new SchedulePaymentFormValidator(this);

  get paymentTypeOptions() {
    return [
      { id: 'one-time', text: 'One-time payment' },
      { id: 'monthly', text: 'Monthly recurring' },
    ];
  }
  @tracked selectedPaymentType: 'one-time' | 'monthly' | undefined;
  @action onSelectPaymentType(paymentTypeId: string) {
    if (paymentTypeId === 'one-time' && !this.paymentDate) {
      this.paymentDate = new Date();
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

  @use maxGasDescriptions = resource(() => {
    const state: MaxGasDescriptionsState = new TrackedObject({
      isLoading: true,
      isIndeterminate: false
    });
    if (!this.wallet.isConnected) {
      state.isIndeterminate = true;
      return state;
    }
    let { selectedGasToken } = this;
    if (!selectedGasToken) {
      state.isIndeterminate = true;
      return state;
    }
    let paymentTokenAddress = this.paymentToken?.address;
    if (!paymentTokenAddress) {
      state.isIndeterminate = true;
      return state;
    }
    if (!this.selectedPaymentType) {
      state.isIndeterminate = true;
      return state;
    }

    // because networkInfo is tracked, anytime the network switches,
    // this resource will re-run
    const scenario = this.selectedPaymentType === 'one-time' ? 'execute_one_time_payment' : 'execute_recurring_payment';
    (async () => {
      try {
        let result = await this.scheduledPaymentsSDK.getScheduledPaymentGasEstimation(scenario, paymentTokenAddress, selectedGasToken.address);
        let gasRangeInWei = result.gasRangeInWei.standard;
        state.value = {
          normal: `Less than ${fromWei((gasRangeInWei.mul(2)).toString(), 'ether')} ${selectedGasToken.symbol}`,
          high: `Less than ${fromWei(gasRangeInWei.mul(4).toString(), 'ether')} ${selectedGasToken.symbol}`,
          max: `Capped at ${fromWei(gasRangeInWei.mul(6).toString(), 'ether')} ${selectedGasToken.symbol}`,
        };
      } catch (error) {
        console.error(error);
        state.error = error;
      } finally {
        state.isLoading = false;
      }
    })();
    return state;
  });

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
      @isRecipientAddressInvalid={{this.validator.isRecipientAddressInvalid}}
      @recipientAddressErrorMessage={{this.validator.recipientAddressErrorMessage}}
      @onUpdateRecipientAddress={{this.onUpdateRecipientAddress}}
      @paymentAmount={{this.paymentAmount}}
      @onUpdatePaymentAmount={{this.onUpdatePaymentAmount}}
      @isPaymentAmountInvalid={{this.validator.isPaymentAmountInvalid}}
      @paymentTokenErrorMessage={{this.validator.paymentTokenErrorMessage}}
      @paymentToken={{this.paymentToken}}
      @paymentTokens={{this.paymentTokens}}
      @onUpdatePaymentToken={{this.onUpdatePaymentToken}}
      @selectedGasToken={{this.selectedGasToken}}
      @gasTokens={{withTokenIcons this.tokens.gasTokens.value}}
      @onSelectGasToken={{this.onSelectGasToken}}
      @maxGasFee={{this.maxGasFee}}
      @onUpdateMaxGasFee={{this.onUpdateMaxGasFee}}
      @onSchedulePayment={{this.schedulePayment}}
      @isSubmitEnabled={{this.isValid}}
      @maxGasDescriptions={{this.maxGasDescriptions.value}}
    />
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'SchedulePaymentFormActionCard': typeof SchedulePaymentFormActionCard;
  }
}
