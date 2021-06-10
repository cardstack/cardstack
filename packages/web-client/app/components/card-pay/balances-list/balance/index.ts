import BN from 'bn.js';
import Component from '@glimmer/component';
import { TokenDisplayInfo } from '@cardstack/web-client/utils/token';

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
      case 'DAI.CPXD':
      case 'XDAI':
        return TokenDisplayInfo.iconFor('DAI');
      case 'CARD':
      case 'CARD.CPXD':
        return TokenDisplayInfo.iconFor('CARD');
      default:
        return undefined;
    }
  }
}
