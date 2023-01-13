import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import { BigNumber, utils as ethersUtils } from 'ethers';

export default class TokenQuantity {
  // Count is the number of tokens, denominated in the smallest unit of the token. e.g. wei for Ethereum
  constructor(public token: SelectableToken, public count: BigNumber) {}

  static fromInput(token: SelectableToken, decimalString: string) {
    let count;
    try {
      count = ethersUtils.parseUnits(decimalString, token.decimals);
    } catch (e) {
      count = BigNumber.from('0');
    }
    return new TokenQuantity(token, count);
  }

  get decimalString() {
    return ethersUtils.formatUnits(this.count, this.decimals);
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
