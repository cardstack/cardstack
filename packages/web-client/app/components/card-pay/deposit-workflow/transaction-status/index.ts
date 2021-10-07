import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import BN from 'bn.js';
import { tracked } from '@glimmer/tracking';
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
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  get selectedTokenSymbol(): TokenSymbol {
    return this.args.workflowSession.getValue('depositSourceToken')!;
  }
  get relayTokensTxnReceipt(): TransactionReceipt {
    return this.args.workflowSession.getValue('relayTokensTxnReceipt')!;
  }
  get completedLayer2TxnReceipt(): TransactionReceipt | null {
    return this.args.workflowSession.getValue('completedLayer2TxnReceipt');
  }

  get layer2BlockHeightBeforeBridging(): BN {
    return this.args.workflowSession.getValue(
      'layer2BlockHeightBeforeBridging'
    )!;
  }
  @tracked completedStepCount = 1;
  @tracked bridgeError = false;
  @tracked blockCountError = false;
  @tracked blockCount = 0;

  get totalBlockCount(): number {
    return this.layer1Network.strategy.bridgeConfirmationBlockCount;
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
    if (this.completedLayer2TxnReceipt) {
      this.completedStepCount = 3;
      this.blockCount = this.totalBlockCount;
      this.args.onComplete?.();
    } else {
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
        this.layer2BlockHeightBeforeBridging
      );
      this.layer2Network.refreshSafesAndBalances();
      this.args.workflowSession.setValue(
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
