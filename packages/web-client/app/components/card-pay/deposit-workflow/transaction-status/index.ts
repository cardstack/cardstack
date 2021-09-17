import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import BN from 'bn.js';
import { tracked } from '@glimmer/tracking';
import { reads } from 'macro-decorators';
import * as Sentry from '@sentry/browser';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { TokenSymbol } from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { TransactionReceipt } from 'web3-core';
import { task } from 'ember-concurrency-decorators';
import { taskFor } from 'ember-concurrency-ts';
import { TaskGenerator } from 'ember-concurrency';

class CardPayDepositWorkflowTransactionStatusComponent extends Component<WorkflowCardComponentArgs> {
  totalBlockCount: number;
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @reads('args.workflowSession.state.depositSourceToken')
  declare selectedTokenSymbol: TokenSymbol;
  @reads('args.workflowSession.state.relayTokensTxnReceipt')
  declare relayTokensTxnReceipt: TransactionReceipt;
  @reads('args.workflowSession.state.completedLayer2TxnReceipt')
  declare completedLayer2TxnReceipt: TransactionReceipt | undefined;
  @reads('args.workflowSession.state.layer2BlockHeightBeforeBridging')
  declare layer2BlockHeightBeforeBridging: BN | undefined;
  @tracked completedStepCount = 1;
  @tracked bridgeError = false;
  @tracked blockCountError = false;
  @tracked blockCount = 0;

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
    this.totalBlockCount =
      this.layer1Network.strategy.bridgeConfirmationBlockCount;
    if (!this.completedLayer2TxnReceipt) {
      taskFor(this.waitForBlockConfirmationsTask)
        .perform()
        .catch((e) => {
          console.error('Failed to complete block confirmations');
          console.error(e);
          Sentry.captureException(e);
          this.blockCountError = true;
        });
    }
  }

  get displayBridgingSubstate() {
    return taskFor(this.waitForBlockConfirmationsTask).isRunning;
  }

  get bridgingSubstate() {
    if (this.blockCount <= this.totalBlockCount) {
      return `${this.blockCount} of ${this.totalBlockCount} blocks confirmed`;
    } else if (this.blockCount > this.totalBlockCount) {
      return `Waiting for bridge validators`;
    } else {
      return '';
    }
  }

  @task *waitForBlockConfirmationsTask(): TaskGenerator<void> {
    let blockNumber = this.relayTokensTxnReceipt.blockNumber;
    while (this.blockCount <= this.totalBlockCount + 1) {
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
      this.layer2Network.refreshSafesAndBalances();
      this.args.workflowSession.update(
        'completedLayer2TxnReceipt',
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
      this.relayTokensTxnReceipt.transactionHash
    );
  }

  get bridgeExplorerUrl() {
    return this.layer1Network.bridgeExplorerUrl(
      this.relayTokensTxnReceipt.transactionHash
    );
  }

  get blockscoutUrl() {
    return this.layer2Network.blockExplorerUrl(
      this.completedLayer2TxnReceipt!.transactionHash
    );
  }
}

export default CardPayDepositWorkflowTransactionStatusComponent;
