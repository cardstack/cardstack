import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import {
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/token';

import { toBN, toWei } from 'web3-utils';
import BN from 'bn.js';

interface CardPayAmountInputArgs {
  onInputAmount: (value: string, isValid: boolean) => void;
  tokenBalance: BN;
  tokenSymbol: TokenSymbol;
}

export default class CardPayAmountInput extends Component<CardPayAmountInputArgs> {
  @tracked amount: string = '';
  @tracked isDirty = false;

  constructor(owner: unknown, args: CardPayAmountInputArgs) {
    super(owner, args);
    this.setAmount('');
  }

  get tokenDetails(): TokenDisplayInfo | undefined {
    if (this.args.tokenSymbol) {
      return new TokenDisplayInfo(this.args.tokenSymbol);
    } else {
      return undefined;
    }
  }

  get isValidNumber() {
    return !!parseFloat(this.amount);
  }

  get amountAsBN() {
    return toBN(toWei(this.amount));
  }

  get amountExceedsBalance() {
    return this.amountAsBN.gt(this.args.tokenBalance);
  }

  get amountExceedsEighteenDecimalPlaces() {
    const regex = /^\d*(\.\d{0,18})?$/;
    return !regex.test(this.amount);
  }

  get isInvalid() {
    return !this.isValidNumber || !!this.errorMessage;
  }

  get elementIsInvalid() {
    return this.isDirty && this.isInvalid;
  }

  get errorMessage() {
    if (!this.isValidNumber) {
      return undefined;
    }

    if (this.amountExceedsEighteenDecimalPlaces) {
      return 'must not exceed eighteen decimal places';
    } else if (this.amountExceedsBalance) {
      return 'must not exceed balance';
    }

    return undefined;
  }

  get cleanedAmount() {
    if (this.isValidNumber) {
      if (this.isInvalid) {
        return this.amount;
      }
    } else {
      return '';
    }

    return this.amount;
  }

  @action onInputAmount(amount: string) {
    this.isDirty = true;
    this.setAmount(amount);
  }

  setAmount(amount: string) {
    let trimmedAmount = amount.trim();

    if (!isNaN(+trimmedAmount) && !trimmedAmount.startsWith('-')) {
      this.amount = trimmedAmount;
    } else {
      // eslint-disable-next-line no-self-assign
      this.amount = this.amount; // reject invalid characters as they’re entered
    }

    if (this.isValidNumber) {
      this.args.onInputAmount(this.amount, !this.isInvalid);
    } else {
      this.args.onInputAmount('', false);
    }
  }
}
