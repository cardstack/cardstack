import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import { BigNumber } from 'ethers';
import { formatUnits } from 'ethers/lib/utils';

export default class TokenQuantity {
  // Count is the number of tokens, denominated in the smallest unit of the token. e.g. wei for Ethereum
  constructor(public token: SelectableToken, public count: BigNumber) {}

  get displayable() {
    return `${formatUnits(this.count, this.token.decimals)} ${
      this.token.symbol
    }`;
  }
}
