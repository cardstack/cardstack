import Component from '@glimmer/component';
import {
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/token';

interface CardPayTokenAmountInputArgs {
  amount: string;
  onInputAmount: (value: string, isValid: boolean) => void;
  tokenSymbol: TokenSymbol;
  invalid: boolean;
  errorMessage: string;
}

export default class CardPayTokenAmountInput extends Component<CardPayTokenAmountInputArgs> {
  get tokenDetails(): TokenDisplayInfo | undefined {
    if (this.args.tokenSymbol) {
      return new TokenDisplayInfo(this.args.tokenSymbol);
    } else {
      return undefined;
    }
  }
}
