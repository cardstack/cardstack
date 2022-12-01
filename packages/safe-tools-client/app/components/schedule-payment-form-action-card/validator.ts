import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import { tracked } from '@glimmer/tracking';
import { isAddress } from 'web3-utils';

function isNumeric(str: unknown) {
  if (typeof str !== 'string') return false; // we only process strings!
  return (
    !isNaN(str as never) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str))
  ); // ...and ensure strings of whitespace fail
}

export interface ValidatableForm {
  selectedPaymentType: 'one-time' | 'monthly' | undefined;
  paymentDate: Date | undefined;
  paymentDayOfMonth: number | undefined;
  monthlyUntil: Date | undefined;
  recipientAddress: string;
  paymentAmount: string;
  paymentToken: SelectableToken | undefined;
  selectedGasToken: SelectableToken | undefined;
  maxGasFee: 'normal' | 'high' | 'max' | undefined;
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

  private get isPaymentTypeValid(): boolean {
    const { form } = this;
    if (form.selectedPaymentType === 'one-time') {
      return !!form.paymentDate;
    }
    if (form.selectedPaymentType === 'monthly') {
      return !!form.monthlyUntil && !form.paymentDayOfMonth;
    }
    return false;
  }

  private get isRecipientValid(): boolean {
    return isAddress(this.form.recipientAddress);
  }

  private get isAmountValid(): boolean {
    return isNumeric(this.form.paymentAmount) && !!this.form.paymentToken;
  }

  private get isGasTokenValid(): boolean {
    return !!this.form.selectedGasToken;
  }

  private get isMaxGasFeeValid(): boolean {
    return !!this.form.maxGasFee;
  }
}
