import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import BN from 'bn.js';
import { tracked } from '@glimmer/tracking';
import { reads } from 'macro-decorators';
import * as Sentry from '@sentry/browser';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { TokenSymbol } from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { TransactionReceipt } from 'web3-core';
import { task } from 'ember-concurrency-decorators';
import { taskFor } from 'ember-concurrency-ts';
import { TaskGenerator } from 'ember-concurrency';

class CardPayDepositWorkflowTransactionStatusComponent extends Component<WorkflowCardComponentArgs> {
  totalBlockCount = 12;
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @reads('args.workflowSession.state.depositSourceToken')
  declare selectedTokenSymbol: TokenSymbol;
  @reads('args.workflowSession.state.relayTokensTxnReceipt')
  declare relayTxnReceipt: TransactionReceipt;
  @tracked completedStepCount = 1;
  @tracked bridgeError = false;
  @tracked blockCountError = false;
  @tracked blockCount = 0;

  get layer2BlockHeightBeforeBridging(): BN | undefined {
    return this.args.workflowSession.state.layer2BlockHeightBeforeBridging;
  }
  get progressSteps() {
    return [
      {
        title: `Deposit tokens into reserve pool on ${c.layer1.fullName}`,
      },
      {
        title: `Bridge tokens from ${c.layer1.fullName} to ${c.layer2.fullName}`,
      },
      {
        title: `Mint tokens on ${c.layer2.shortName}: ${this.selectedTokenSymbol}.CPXD`,
      },
    ];
  }

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    taskFor(this.waitForBlockConfirmationsTask)
      .perform()
      .catch((e) => {
        this.blockCountError = true;
        console.error(e);
      });
  }

  get displaySubstate() {
    return taskFor(this.waitForBlockConfirmationsTask).isRunning;
  }

  get substate() {
    if (this.blockCount < this.totalBlockCount) {
      return `Waiting for ${this.blockCount + 1} of ${
        this.totalBlockCount
      } block confirmations`;
    } else if (this.blockCount === this.totalBlockCount) {
      return `Waiting for bridge validators`;
    } else {
      return '';
    }
  }

  @task *waitForBlockConfirmationsTask(): TaskGenerator<void> {
    let blockNumber = this.relayTxnReceipt.blockNumber;
    while (this.blockCount <= this.totalBlockCount) {
      yield this.layer1Network.getBlockConfirmation(blockNumber++);
      this.blockCount++;
    }
    this.completedStepCount++;
    this.waitForBridgingToComplete();
  }

  async waitForBridgingToComplete() {
    try {
      let transactionReceipt = await this.layer2Network.awaitBridgedToLayer2(
        this.layer2BlockHeightBeforeBridging!
      );
      this.layer2Network.refreshBalances();
      this.args.workflowSession.update(
        'completedLayer2TransactionReceipt',
        transactionReceipt
      );
      this.completedStepCount++;
      this.args.onComplete?.();
    } catch (e) {
      console.error('Failed to complete bridging to layer 2');
      console.error(e);
      Sentry.captureException(e);
      this.bridgeError = true;
    }
  }

  get depositTxnViewerUrl() {
    return this.layer1Network.blockExplorerUrl(
      this.relayTxnReceipt.transactionHash
    );
  }

  get bridgeExplorerUrl() {
    return this.layer1Network.bridgeExplorerUrl(
      this.relayTxnReceipt.transactionHash
    );
  }

  get blockscoutUrl() {
    return this.layer2Network.blockExplorerUrl(
      this.args.workflowSession.state.completedLayer2TransactionReceipt
        .transactionHash
    );
  }
}

export default CardPayDepositWorkflowTransactionStatusComponent;
