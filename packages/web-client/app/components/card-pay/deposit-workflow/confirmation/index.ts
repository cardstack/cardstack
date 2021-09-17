import Component from '@glimmer/component';
import { reads } from 'macro-decorators';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import BN from 'bn.js';
import { next } from '@ember/runloop';
import {
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';

class CardPayDepositWorkflowConfirmationComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @reads('args.workflowSession.state.depositSourceToken')
  declare selectedTokenSymbol: TokenSymbol;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    next(this, () => {
      this.args.onComplete?.();
    });
  }

  get depositedToken() {
    return new TokenDisplayInfo(this.selectedTokenSymbol);
  }

  get depositedAmount(): BN {
    return new BN(this.args.workflowSession.state.depositedAmount);
  }

  get receivedToken() {
    if (this.selectedTokenSymbol === 'CARD') {
      return new TokenDisplayInfo('CARD.CPXD');
    } else {
      return new TokenDisplayInfo('DAI.CPXD');
    }
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
      this.args.workflowSession.state.completedLayer2TxnReceipt &&
      this.layer2Network.blockExplorerUrl(
        this.args.workflowSession.state.completedLayer2TxnReceipt
          .transactionHash
      )
    );
  }

  get depotAddress() {
    return this.layer2Network.depotSafe?.address;
  }
}

export default CardPayDepositWorkflowConfirmationComponent;
