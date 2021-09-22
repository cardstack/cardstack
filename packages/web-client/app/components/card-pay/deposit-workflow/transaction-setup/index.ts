import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import BN from 'bn.js';

import {
  BridgeableSymbol,
  TokenSymbol,
  bridgeableSymbols,
  TokenBalance,
} from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { next } from '@ember/runloop';

class CardPayDepositWorkflowTransactionSetupComponent extends Component<WorkflowCardComponentArgs> {
  tokenOptions = bridgeableSymbols;
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @tracked selectedToken: TokenBalance<BridgeableSymbol> | undefined;

  get selectedTokenSymbol() {
    if (this.args.workflowSession.state.depositSourceToken) {
      return this.args.workflowSession.state.depositSourceToken;
    } else if (this.layer1Network.daiBalance?.gt(new BN('0'))) {
      return 'DAI';
    } else if (this.layer1Network.cardBalance?.gt(new BN('0'))) {
      return 'CARD';
    }
    return undefined;
  }

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    this.selectedToken = this.tokens.find(
      (t) => t.symbol === this.selectedTokenSymbol
    );
    next(this, () => {
      this.args.workflowSession.update(
        'depositSourceToken',
        this.selectedToken?.symbol
      );
    });
  }

  get noTokenBalance() {
    return (
      (!this.layer1Network.daiBalance ||
        this.layer1Network.daiBalance.isZero()) &&
      (!this.layer1Network.cardBalance ||
        this.layer1Network.cardBalance.isZero())
    );
  }

  get tokens() {
    return this.tokenOptions.map((symbol) => {
      let balance = this.getTokenBalance(symbol);
      return new TokenBalance(symbol, balance);
    });
  }

  getTokenBalance(symbol: TokenSymbol) {
    if (symbol === 'DAI') {
      return this.layer1Network.daiBalance ?? new BN('0');
    } else if (symbol === 'CARD') {
      return this.layer1Network.cardBalance ?? new BN('0');
    } else {
      return new BN('0');
    }
  }

  get isCtaDisabled() {
    if (
      this.selectedTokenSymbol &&
      this.selectedToken?.balance.gt(new BN('0'))
    ) {
      return false;
    }
    return true;
  }

  @action chooseSource(token: TokenBalance<BridgeableSymbol>) {
    this.selectedToken = token;
    this.args.workflowSession.update(
      'depositSourceToken',
      this.selectedToken.symbol
    );
  }

  @action save() {
    if (this.isCtaDisabled) {
      return;
    }
    if (this.selectedToken) {
      this.args.workflowSession.update(
        'depositSourceToken',
        this.selectedToken.symbol
      );
      this.args.onComplete?.();
    }
  }
}

export default CardPayDepositWorkflowTransactionSetupComponent;
