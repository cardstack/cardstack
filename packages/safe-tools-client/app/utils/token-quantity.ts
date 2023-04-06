import { TokenDetail } from '@cardstack/cardpay-sdk';
import { BigNumber, utils as ethersUtils } from 'ethers';

const SIGNIFICANT_DIGITS = 6;

export default class TokenQuantity {
  // Count is the number of tokens, denominated in the smallest unit of the token. e.g. wei for Ethereum
  constructor(public token: TokenDetail, public count: BigNumber) {}

  static fromInput(token: TokenDetail, decimalString: string) {
    let count;
    try {
      count = ethersUtils.parseUnits(decimalString, token.decimals);
    } catch (e) {
      count = BigNumber.from('0');
    }
    return new TokenQuantity(token, count);
  }

  get decimalString() {
    const value = ethersUtils.formatUnits(this.count, this.decimals);
    let formattedValue = parseFloat(value).toPrecision(SIGNIFICANT_DIGITS);
    if (formattedValue.match(/e-\d/)) {
      formattedValue = parseFloat(value)
        .toFixed(12)
        .replace(/\.?0+$/, '');
    } else if (formattedValue.match(/e\+\d/)) {
      formattedValue = parseFloat(value)
        .toString()
        .replace(/\.\d+$/, '');
    } else {
      formattedValue = formattedValue.replace(/\.?0+$/, '');
    }
    return formattedValue;
  }

  get symbol() {
    return this.token.symbol;
  }

  get address() {
    return this.token.address;
  }

  get decimals() {
    return this.token.decimals;
  }

  get displayable() {
    return `${this.decimalString} ${this.symbol}`;
  }
}
