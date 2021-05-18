import Component from '@glimmer/component';
import { reads } from 'macro-decorators';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import WorkflowSession from '../../../../models/workflow/workflow-session';
import { toBN } from 'web3-utils';
import BN from 'bn.js';
import { next } from '@ember/runloop';
import {
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/web3-strategies/token-display-info';

interface CardPayDepositWorkflowConfirmationComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: () => void;
}
class CardPayDepositWorkflowConfirmationComponent extends Component<CardPayDepositWorkflowConfirmationComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @reads('args.workflowSession.state.depositSourceToken')
  declare selectedTokenSymbol: TokenSymbol;

  constructor(
    owner: unknown,
    args: CardPayDepositWorkflowConfirmationComponentArgs
  ) {
    super(owner, args);
    next(this, () => {
      this.args.onComplete();
    });
  }

  get depositedToken() {
    return new TokenDisplayInfo(this.selectedTokenSymbol);
  }

  get depositedAmount(): BN {
    return toBN(this.args.workflowSession.state.depositedAmount);
  }

  get depositTxnViewerUrl(): string | undefined {
    return this.layer1Network.blockExplorerUrl(
      this.args.workflowSession.state.relayTokensTxnReceipt.transactionHash
    );
  }

  get bridgeExplorerUrl(): string | undefined {
    return this.layer1Network.bridgeExplorerUrl(
      this.args.workflowSession.state.relayTokensTxnReceipt.transactionHash
    );
  }

  get blockscoutUrl(): string {
    return (
      this.args.workflowSession.state.completedLayer2TransactionReceipt &&
      this.layer2Network.blockExplorerUrl(
        this.args.workflowSession.state.completedLayer2TransactionReceipt
          .transactionHash
      )
    );
  }

  get depotAddress(): string {
    return this.args.workflowSession.state.depotAddress;
  }
}

export default CardPayDepositWorkflowConfirmationComponent;
