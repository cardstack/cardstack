import BN from 'bn.js';
import Component from '@glimmer/component';
import { TokenDisplayInfo } from '@cardstack/ssr-web/utils/token';

interface CardPayBalancesListBalanceComponentArgs {
  symbol: string;
  amount: BN;
}

export default class CardPayBalancesListBalanceComponent extends Component<CardPayBalancesListBalanceComponentArgs> {
  get icon() {
    return TokenDisplayInfo.iconFor(this.args.symbol);
  }
}
