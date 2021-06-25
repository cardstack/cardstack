import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import BN from 'web3-core/node_modules/@types/bn.js';
import { toBN } from 'web3-utils';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import {
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/token';

interface Token {
  balance?: BN;
  icon: string;
  name: string;
  description?: string;
  symbol: TokenSymbol;
}

interface FundingSourceCardArgs {
  workflowSession: WorkflowSession;
  onComplete: (() => void) | undefined;
  onIncomplete: (() => void) | undefined;
  isComplete: boolean;
}

class FundingSourceCard extends Component<FundingSourceCardArgs> {
  defaultTokenSymbol: TokenSymbol = 'DAI.CPXD';
  tokenOptions = [this.defaultTokenSymbol];
  @service declare layer2Network: Layer2Network;
  @tracked selectedTokenSymbol: TokenSymbol =
    this.args.workflowSession.state.prepaidFundingToken ??
    this.defaultTokenSymbol;
  @tracked selectedToken: Token;

  constructor(owner: unknown, args: FundingSourceCardArgs) {
    super(owner, args);
    this.selectedToken =
      this.tokens.find((t) => t.symbol === this.selectedTokenSymbol) ??
      this.tokens[0];
  }

  get depotAddress() {
    return this.layer2Network.depotSafe?.address || undefined;
  }

  get tokens() {
    return this.tokenOptions.map((symbol) => {
      let tokenInfo = new TokenDisplayInfo(symbol);
      let balance = this.getTokenBalance(symbol);
      return {
        ...tokenInfo,
        balance,
      };
    });
  }

  getTokenBalance(symbol: TokenSymbol) {
    if (symbol === this.defaultTokenSymbol) {
      return this.layer2Network.defaultTokenBalance ?? toBN('0');
    }
    return toBN('0');
  }

  get isDisabled() {
    return (
      !this.depotAddress ||
      !this.tokens.length ||
      !this.selectedToken.balance ||
      this.selectedToken.balance.isZero()
    );
  }

  @action chooseSource(token: Token) {
    this.selectedToken = token;
  }

  @action save() {
    if (this.isDisabled) {
      return;
    }
    if (this.selectedTokenSymbol) {
      this.args.workflowSession.update(
        'prepaidFundingToken',
        this.selectedTokenSymbol
      );
    }
    this.args.onComplete?.();
  }
}

export default FundingSourceCard;
