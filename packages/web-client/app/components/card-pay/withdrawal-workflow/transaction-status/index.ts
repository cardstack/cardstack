import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import BN from 'bn.js';
import { taskFor } from 'ember-concurrency-ts';
import { task, TaskGenerator } from 'ember-concurrency';
import * as Sentry from '@sentry/browser';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { BridgedTokenSymbol } from '@cardstack/web-client/utils/token';
import { TransactionHash } from '@cardstack/web-client/utils/web3-strategies/types';

class CardPayWithdrawalWorkflowTransactionStatusComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;

  @tracked completedCount = 1;
  @tracked error = false;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    taskFor(this.awaitBridgingTask).perform();
  }

  @task *awaitBridgingTask(): TaskGenerator<void> {
    let { workflowSession } = this.args;
    let relayTokensTxnHash =
      workflowSession.getValue<TransactionHash>('relayTokensTxnHash')!;
    try {
      if (!workflowSession.getValue('bridgeValidationResult')) {
        let result = yield this.layer2Network.awaitBridgedToLayer1(
          this.layer2BlockHeightBeforeBridging!,
          relayTokensTxnHash
        );
        workflowSession.setValue('bridgeValidationResult', result);
      }
      this.layer2Network.refreshSafesAndBalances();
      this.completedCount = 2;
      this.args.onComplete?.();
    } catch (e) {
      console.error('Failed to complete bridging to layer 1');
      console.error(e);
      Sentry.captureException(e);
      this.error = true;
    }
  }

  get isInProgress() {
    return !this.args.workflowSession.getValue('bridgeValidationResult');
  }

  get currentTokenSymbol(): BridgedTokenSymbol {
    return this.args.workflowSession.getValue('withdrawalToken')!;
  }

  get layer2BlockHeightBeforeBridging(): BN | null {
    return this.args.workflowSession.getValue(
      'layer2BlockHeightBeforeBridging'
    );
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
      this.args.workflowSession.getValue('relayTokensTxnHash')!
    );
  }

  get blockscoutUrl() {
    return this.layer2Network.blockExplorerUrl(
      this.args.workflowSession.getValue('relayTokensTxnHash')!
    );
  }
}

export default CardPayWithdrawalWorkflowTransactionStatusComponent;
