import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import { tracked } from '@glimmer/tracking';
import { isAddress } from 'web3-utils';

export interface ValidatableForm {
  selectedGasToken: SelectableToken | undefined;
  paymentToken: SelectableToken | undefined;
  paymentAmount: string;
  recipientAddress: string;
  paymentDayOfMonth: number | undefined;
  monthlyUntil: Date | undefined;
  paymentDate: Date | undefined;
  selectedPaymentType: 'one-time' | 'monthly' | undefined;
  maxGasFee: string | undefined;
}

export default class SchedulePaymentFormValidator {
  form: ValidatableForm;

  @tracked isRecipientAddressInvalid = false;
  @tracked recipientAddressErrorMessage = '';
  @tracked isPaymentAmountInvalid = false;
  @tracked paymentTokenErrorMessage = '';

  constructor(form: ValidatableForm) {
    this.form = form;
  }

  showErrors = false;

  get isValid() {
    return (
      this.isPaymentTypeValid &&
      this.isRecipientValid &&
      this.isAmountValid &&
      this.isGasTokenValid &&
      this.isMaxGasFeeValid
    );
  }

  get isPaymentTypeValid(): boolean {
    const { form } = this;
    if (form.selectedPaymentType === 'one-time') {
      return !!form.paymentDate;
    }
    if (form.selectedPaymentType === 'monthly') {
      return !!form.monthlyUntil && !form.paymentDayOfMonth;
    }
    return false;
  }

  get isRecipientValid(): boolean {
    return isAddress(this.form.recipientAddress);
  }

  get isAmountValid(): boolean {
    return !!this.form.paymentAmount && !!this.form.paymentToken;
  }

  get isGasTokenValid(): boolean {
    return !!this.form.selectedGasToken;
  }

  get isMaxGasFeeValid(): boolean {
    return !!this.form.maxGasFee;
  }
}
