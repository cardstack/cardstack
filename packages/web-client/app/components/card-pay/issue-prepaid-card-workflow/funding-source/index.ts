import Component from '@glimmer/component';
import { action } from '@ember/object';
import { reads } from 'macro-decorators';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { task } from 'ember-concurrency-decorators';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import WorkflowSession from '../../../../models/workflow/workflow-session';
import BN from 'bn.js';
import { toBN } from 'web3-utils';
import {
  TokenDisplayInfo,
  TokenSymbol,
  bridgeableSymbols,
} from '@cardstack/web-client/utils/token';
import { DepotSafe } from '@cardstack/cardpay-sdk/sdk/safes';

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

class FundingSourceCard extends Component<FundingSourceCardArgs> {
  tokenInfo = bridgeableSymbols.map((symbol) => new TokenDisplayInfo(symbol));
  @service declare layer2Network: Layer2Network;

  @reads('args.workflowSession.state.prepaidFundingToken')
  declare selectedToken: Token;

  constructor(owner: unknown, args: FundingSourceCardArgs) {
    super(owner, args);
    taskFor(this.fetchDepotTask)
      .perform()
      .then((depot: DepotSafe) => {
        if (depot) {
          this.args.workflowSession.update('depotAddress', depot.address);
          this.args.workflowSession.update('depotTokens', depot.tokens);
          if (!this.selectedToken) this.chooseSource(this.tokens[0]);
        }
      });
  }

  @task *fetchDepotTask(): any {
    let depot = yield this.layer2Network.fetchDepot();
    return depot;
  }

  get depotTokens() {
    return this.args.workflowSession.state.depotTokens || [];
  }

  @action getBalance(symbol: TokenSymbol) {
    if (symbol && this.depotTokens.length) {
      let depotToken = this.depotTokens.find(
        (item: { balance: string; token: { symbol: TokenSymbol } }) =>
          item?.token?.symbol === symbol
      );
      if (depotToken.balance) {
        return toBN(depotToken.balance);
      }
    }
    return toBN(0);
  }

  get tokens() {
    return this.tokenInfo.map((token) => {
      let balance = this.getBalance(token.symbol);
      return {
        ...token,
        balance,
      } as Token;
    });
  }

  @action chooseSource(token: Token) {
    this.args.workflowSession.update('prepaidFundingToken', token);
  }
}

export default FundingSourceCard;
