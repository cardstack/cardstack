import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import BN from 'bn.js';

import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { TokenBalance, TokenSymbol } from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';

class FundingSourceCard extends Component<WorkflowCardComponentArgs> {
  defaultTokenSymbol: TokenSymbol = 'DAI.CPXD';
  tokenOptions = [this.defaultTokenSymbol];
  @service declare layer2Network: Layer2Network;
  @tracked selectedTokenSymbol: TokenSymbol =
    this.args.workflowSession.state.prepaidFundingToken ??
    this.defaultTokenSymbol;
  @tracked selectedToken: TokenBalance;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
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
      let balance = this.getTokenBalance(symbol);
      return new TokenBalance(symbol, balance);
    });
  }

  getTokenBalance(symbol: TokenSymbol) {
    if (symbol === this.defaultTokenSymbol) {
      return this.layer2Network.defaultTokenBalance ?? new BN('0');
    }
    return new BN('0');
  }

  get isDisabled() {
    return (
      !this.depotAddress ||
      !this.tokens.length ||
      !this.selectedToken.balance ||
      this.selectedToken.balance.isZero()
    );
  }

  @action chooseSource(token: TokenBalance) {
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
