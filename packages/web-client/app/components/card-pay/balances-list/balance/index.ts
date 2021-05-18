import BN from 'bn.js';
import Component from '@glimmer/component';
import { TokenDisplayInfo } from '@cardstack/web-client/utils/web3-strategies/token-display-info';

interface CardPayBalancesListBalanceComponentArgs {
  symbol: string;
  amount: BN;
}

export default class CardPayBalancesListBalanceComponent extends Component<CardPayBalancesListBalanceComponentArgs> {
  get icon() {
    switch (this.args.symbol) {
      case 'ETH':
        return TokenDisplayInfo.iconFor('ETH');
      case 'DAI':
      case 'XDAI':
        return TokenDisplayInfo.iconFor('DAI');
      case 'CARD':
        return TokenDisplayInfo.iconFor('CARD');
      default:
        return undefined;
    }
  }
}
