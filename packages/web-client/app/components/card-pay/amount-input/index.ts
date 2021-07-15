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

  constructor(owner: unknown, args: CardPayAmountInputArgs) {
    super(owner, args);
    this.onInputAmount('');
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
        if (this.amountExceedsEighteenDecimalPlaces) {
          let [before, after] = this.amount.split('.');
          return `${before}.${after.substring(0, 18)}`;
        } else {
          return this.amount;
        }
      }
    } else {
      return '';
    }

    return this.amount;
  }

  @action onInputAmount(amount: string) {
    if (!isNaN(+amount)) {
      this.amount = amount.trim();
    } else {
      // eslint-disable-next-line no-self-assign
      this.amount = this.amount; // reject invalid characters as they’re entered
    }

    if (this.isValidNumber) {
      if (this.isInvalid) {
        this.args.onInputAmount(this.cleanedAmount, false);
      } else {
        this.args.onInputAmount(this.amount, true);
      }
    } else {
      this.args.onInputAmount('', false);
    }
  }
}
