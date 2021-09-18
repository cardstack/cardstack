import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import BN from 'bn.js';

import Layer2Network from '@cardstack/web-client/services/layer2-network';
import {
  TokenBalance,
  BridgedTokenSymbol,
} from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';

class FundingSourceCard extends Component<WorkflowCardComponentArgs> {
  defaultTokenSymbol: BridgedTokenSymbol = 'DAI.CPXD';
  tokenOptions = [this.defaultTokenSymbol];
  @service declare layer2Network: Layer2Network;
  @tracked selectedTokenSymbol: BridgedTokenSymbol =
    this.args.workflowSession.state.prepaidFundingToken ??
    this.defaultTokenSymbol;

  get selectedToken(): TokenBalance<BridgedTokenSymbol> {
    return (
      this.tokens.find((t) => t.symbol === this.selectedTokenSymbol) ??
      this.tokens[0]
    );
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

  getTokenBalance(symbol: BridgedTokenSymbol) {
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

  @action chooseSource(token: TokenBalance<BridgedTokenSymbol>) {
    this.selectedTokenSymbol = token.symbol;
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
