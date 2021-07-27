import Component from '@glimmer/component';
import { action } from '@ember/object';
import { reads } from 'macro-decorators';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import BN from 'bn.js';

import {
  TokenDisplayInfo,
  TokenSymbol,
  bridgeableSymbols,
} from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';

class CardPayDepositWorkflowTransactionSetupComponent extends Component<WorkflowCardComponentArgs> {
  tokens = bridgeableSymbols.map((symbol) => new TokenDisplayInfo(symbol));
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;

  @reads('args.workflowSession.state.depositSourceToken')
  declare selectedTokenSymbol: TokenSymbol;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
  }

  get selectedToken() {
    if (
      this.selectedTokenSymbol &&
      TokenDisplayInfo.isRecognizedSymbol(this.selectedTokenSymbol)
    ) {
      return new TokenDisplayInfo(this.selectedTokenSymbol);
    } else {
      return undefined;
    }
  }

  get selectedTokenBalance() {
    if (this.selectedTokenSymbol === 'DAI') {
      return this.layer1Network.daiBalance;
    } else if (this.selectedTokenSymbol === 'CARD') {
      return this.layer1Network.cardBalance;
    } else {
      return new BN(0);
    }
  }

  @action chooseSource(tokenSymbol: string) {
    this.args.workflowSession.update('depositSourceToken', tokenSymbol);
  }

  @action toggleComplete() {
    if (this.args.isComplete) {
      this.args.onIncomplete?.();
    } else if (
      this.selectedTokenSymbol &&
      this.selectedTokenBalance?.gt(new BN(0))
    ) {
      this.args.onComplete?.();
    } else {
      // TODO error message
    }
  }
}

export default CardPayDepositWorkflowTransactionSetupComponent;
