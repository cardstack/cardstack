import Component from '@glimmer/component';
import { action } from '@ember/object';
import { reads } from 'macro-decorators';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import WorkflowSession from '../../../../models/workflow/workflow-session';
import BN from 'bn.js';
import { toBN } from 'web3-utils';
import {
  TokenDisplayInfo,
  TokenSymbol,
  bridgedSymbols,
} from '@cardstack/web-client/utils/token';

interface Token {
  balance: BN;
  icon: string;
  name: string;
  description: string;
  symbol: TokenSymbol;
}

interface FundingSourceCardArgs {
  workflowSession: WorkflowSession;
  onComplete: (() => void) | undefined;
  onIncomplete: (() => void) | undefined;
  isComplete: boolean;
}

// we are assuming that the depot has enough tokens to create card
// and we cancel the workflow earlier if it doesn't
class FundingSourceCard extends Component<FundingSourceCardArgs> {
  tokenInfo = bridgedSymbols.map((symbol) => new TokenDisplayInfo(symbol));
  @service declare layer2Network: Layer2Network;

  @reads('args.workflowSession.state.prepaidFundingToken')
  declare selectedToken: Token;

  constructor(owner: unknown, args: FundingSourceCardArgs) {
    super(owner, args);
    this.chooseSource(this.tokens[0]);
  }

  get depotAddress() {
    return this.layer2Network.depotSafe?.address || undefined;
  }

  getBalance(symbol: TokenSymbol) {
    if (symbol === 'DAI.CPXD') {
      return this.layer2Network.defaultTokenBalance;
    }

    if (symbol === 'CARD.CPXD') {
      return this.layer2Network.cardBalance;
    }
    return toBN(0);
  }

  get tokens() {
    return this.tokenInfo
      .map((token) => {
        let balance = this.getBalance(token.symbol);
        return {
          ...token,
          balance,
        } as Token;
      })
      .filter((v) => !v.balance.isZero());
  }

  @action chooseSource(token: Token) {
    this.args.workflowSession.update('prepaidFundingToken', token);
  }
}

export default FundingSourceCard;
