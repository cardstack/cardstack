import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
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
  minPaymentDate: Date;
  minPaymentTime: Date;
  paymentDate: Date | undefined;
  paymentDayOfMonth: number | undefined;
  minMonthlyUntil: Date;
  monthlyUntil: Date | undefined;
  payeeAddress: string;
  paymentAmount: string;
  paymentToken: SelectableToken | undefined;
  selectedGasToken: SelectableToken | undefined;
  maxGasPrice: 'normal' | 'high' | 'max' | undefined;
}

export default class SchedulePaymentFormValidator {
  form: ValidatableForm;

  constructor(form: ValidatableForm) {
    this.form = form;
  }

  showErrors = false;

  get isValid() {
    return (
      this.isPaymentTypeValid &&
      this.isPayeeAddressValid &&
      this.isAmountValid &&
      this.isGasTokenValid &&
      this.isMaxGasPriceValid
    );
  }

  get isPaymentTypeValid(): boolean {
    return this.paymentTypeErrorMessage === '';
  }

  get paymentTypeErrorMessage(): string {
    const { form } = this;
    if (form.selectedPaymentType === 'one-time') {
      if (!form.paymentDate) {
        return 'must choose a payment date and time';
      }
    } else if (form.selectedPaymentType === 'monthly') {
      if (!form.paymentDayOfMonth) {
        return 'must choose a payment day of month';
      }
      if (!form.monthlyUntil) {
        return 'must choose an until date';
      }
    } else {
      return 'must choose a payment type';
    }
    return '';
  }

  get isPayeeAddressValid(): boolean {
    return this.payeeAddressErrorMessage === '';
  }

  get payeeAddressErrorMessage(): string {
    const { payeeAddress } = this.form;
    if (payeeAddress === '') {
      return "can't be blank";
    }
    if (!isAddress(payeeAddress)) {
      return 'must be a valid chain address';
    }
    return '';
  }

  get isAmountValid(): boolean {
    return this.amountErrorMessage === '';
    return isNumeric(this.form.paymentAmount) && !!this.form.paymentToken;
  }

  get amountErrorMessage(): string {
    if (this.form.paymentAmount === '') {
      return "can't be blank";
    }
    if (!isNumeric(this.form.paymentAmount)) {
      return 'must be numeric';
    }
    if (!this.form.paymentToken) {
      return 'must choose a token for the payment';
    }
    return '';
  }

  get isGasTokenValid(): boolean {
    return this.gasTokenErrorMessage === '';
  }

  get gasTokenErrorMessage() {
    if (!this.form.selectedGasToken) {
      return 'must choose a token to be used to pay for gas';
    }
    return '';
  }

  get isMaxGasPriceValid(): boolean {
    return this.maxGasPriceErrorMessage === '';
  }

  get maxGasPriceErrorMessage(): string {
    if (!this.form.maxGasPrice) {
      return 'must choose a maximum gas fee to allow';
    }
    return '';
  }
}
