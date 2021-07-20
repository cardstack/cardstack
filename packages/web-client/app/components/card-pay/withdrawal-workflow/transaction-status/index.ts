import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { BridgedTokenSymbol } from '@cardstack/web-client/utils/token';

import BN from 'bn.js';
import { taskFor } from 'ember-concurrency-ts';
import { task, TaskGenerator } from 'ember-concurrency';

class CardPayWithdrawalWorkflowTransactionStatusComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;

  @tracked completedCount = 1;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    taskFor(this.awaitBridgingTask).perform();
  }

  @task *awaitBridgingTask(): TaskGenerator<void> {
    let result = yield this.layer2Network.awaitBridgedToLayer1(
      this.layer2BlockHeightBeforeBridging!,
      this.args.workflowSession.state.relayTokensTxnHash
    );
    this.args.workflowSession.update('bridgeValidationResult', result);
    this.layer2Network.refreshBalances();
    this.completedCount = 2;
    this.args.onComplete?.();
  }

  get isInProgress() {
    return !this.args.workflowSession.state.bridgeValidationResult;
  }

  get currentTokenSymbol(): BridgedTokenSymbol {
    return this.args.workflowSession.state.withdrawalToken;
  }

  get layer2BlockHeightBeforeBridging(): BN | undefined {
    return this.args.workflowSession.state.layer2BlockHeightBeforeBridging;
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
    return this.layer2Network.bridgeExplorerUrl(
      this.args.workflowSession.state.relayTokensTxnHash
    );
  }

  get blockscoutUrl() {
    return this.layer2Network.blockExplorerUrl(
      this.args.workflowSession.state.relayTokensTxnHash
    );
  }
}

export default CardPayWithdrawalWorkflowTransactionStatusComponent;
