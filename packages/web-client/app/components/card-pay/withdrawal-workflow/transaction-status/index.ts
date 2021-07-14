import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { BridgedTokenSymbol } from '@cardstack/web-client/utils/token';

import BN from 'bn.js';
import { TransactionReceipt } from 'web3-core';

class CardPayWithdrawalWorkflowTransactionStatusComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;

  @tracked completedCount = 1;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    this.layer1Network
      .awaitBridged(this.layer1BlockHeightBeforeBridging!)
      .then((transactionReceipt: TransactionReceipt) => {
        this.args.workflowSession.update(
          'completedLayer1TransactionReceipt',
          transactionReceipt
        );
        this.completedCount = 2;
        this.args.onComplete();
      });
  }

  get isInProgress() {
    return !this.args.workflowSession.state.completedLayer1TransactionReceipt;
  }

  get currentTokenSymbol(): BridgedTokenSymbol {
    return this.args.workflowSession.state.withdrawalToken;
  }

  get layer1BlockHeightBeforeBridging(): BN | undefined {
    return this.args.workflowSession.state.layer1BlockHeightBeforeBridging;
  }

  get progressSteps() {
    return [
      {
        title: `Withdraw tokens from ${c.layer2.fullName}`,
      },
      {
        title: `Bridge tokens from ${c.layer2.fullName} to ${c.layer1.fullName}`,
      },
    ];
  }

  get bridgeExplorerUrl() {
    return this.layer1Network.bridgeExplorerUrl(
      this.args.workflowSession.state.relayTokensTxnReceipt.transactionHash
    );
  }

  get blockscoutUrl() {
    return this.layer2Network.blockExplorerUrl(
      this.args.workflowSession.state.relayTokensTxnReceipt.transactionHash
    );
  }

  get withdrawalTxnViewerUrl() {
    return this.layer1Network.blockExplorerUrl(
      this.args.workflowSession.state.completedLayer1TransactionReceipt
        .transactionHash
    );
  }
}

export default CardPayWithdrawalWorkflowTransactionStatusComponent;
