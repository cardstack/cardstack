// ethereum-token

import { BigNumber } from '@ethersproject/bignumber';
import Component from '@glimmer/component';

interface CardPayBalancesListBalanceComponentArgs {
  symbol: string;
  amount: BigNumber;
}

export default class CardPayBalancesListBalanceComponent extends Component<CardPayBalancesListBalanceComponentArgs> {
  get icon() {
    switch (this.args.symbol) {
      case 'ETH':
        return 'ethereum-token';
      case 'DAI':
      case 'XDAI':
        return 'dai-token';
      case 'CARD':
        return 'card-token';
      default:
        return undefined;
    }
  }
}
