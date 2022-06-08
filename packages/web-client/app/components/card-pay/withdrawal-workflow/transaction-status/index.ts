import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import BN from 'bn.js';
import { task } from 'ember-concurrency-decorators';
import { taskFor } from 'ember-concurrency-ts';
import {
  race,
  rawTimeout,
  TaskGenerator,
  waitForProperty,
} from 'ember-concurrency';
import * as Sentry from '@sentry/browser';
import config from '@cardstack/web-client/config/environment';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { TransactionHash } from '@cardstack/web-client/utils/web3-strategies/types';
import { TransactionReceipt } from 'web3-core';

const A_WHILE = config.environment === 'test' ? 1 : 1000 * 60 * 2;

class CardPayWithdrawalWorkflowTransactionStatusComponent extends Component<WorkflowCardComponentArgs> {
  TIMEOUT_ERROR = 'TIMEOUT_ERROR';
  NON_TIMEOUT_ERROR = 'NON_TIMEOUT_ERROR';

  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;

  @tracked blockCount = 0;
  @tracked completedCount = 1;
  @tracked error: this['TIMEOUT_ERROR'] | this['NON_TIMEOUT_ERROR'] | undefined;

  @tracked showSlowBridgingMessage = false;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    taskFor(this.awaitTimerTask).perform();
  }

  @task *awaitTimerTask(): TaskGenerator<void> {
    yield race([
      taskFor(this.awaitBridgingTask).perform(),
      taskFor(this.timerTask).perform(),
    ]);
  }

  /**
   * Waiting for block confirmations is to be more certain that we did not relay tokens from the wrong side of a blockchain fork.
   */
  @task *waitForBlockConfirmationsTask() {
    let transactionReceipt: TransactionReceipt =
      this.args.workflowSession.getValue<TransactionReceipt>(
        'relayTokensTxnReceipt'
      )!;
    this.blockCount = 1;
    let blockNumber = transactionReceipt.blockNumber;
    while (this.blockCount <= this.totalBlockCount) {
      // the average block time for a single block on Gnosis chain is 5s.
      // we are only incrementing block by 1, so giving 120s is already a fair amount of time
      // if it times out even then, the user probably needs to refresh
      yield this.layer2Network.getBlockConfirmation(
        blockNumber++,
        2 * 60 * 1000
      );
      this.blockCount++;
    }
  }

  @task *awaitBridgingTask(): TaskGenerator<void> {
    let { workflowSession } = this.args;
    let relayTokensTxnHash =
      workflowSession.getValue<TransactionHash>('relayTokensTxnHash')!;
    try {
      yield taskFor(this.waitForBlockConfirmationsTask).perform();
      if (!workflowSession.getValue('bridgeValidationResult')) {
        let result = yield this.layer2Network.awaitBridgedToLayer1(
          this.layer2BlockHeightBeforeBridging!,
          relayTokensTxnHash
        );
        workflowSession.setValue('bridgeValidationResult', result);
      }
      this.layer2Network.safes.updateOne(
        this.args.workflowSession.getValue<string>('withdrawalSafe')!
      );
      this.completedCount = 2;
      this.showSlowBridgingMessage = false;
      this.args.onComplete?.();
    } catch (e) {
      console.error('Failed to complete bridging to layer 1');
      console.error(e);
      Sentry.captureException(e);
      if (
        e.message.startsWith(
          'Desired block number did not appear after waiting'
        )
      ) {
        this.error = this.TIMEOUT_ERROR;
      } else {
        this.error = this.NON_TIMEOUT_ERROR;
      }
      this.blockCount = 0;
    }
  }

  @task *timerTask(): TaskGenerator<void> {
    this.showSlowBridgingMessage = false;
    yield rawTimeout(A_WHILE);
    this.showSlowBridgingMessage = true;
    yield waitForProperty(this, 'showSlowBridgingMessage', false);
  }

  get totalBlockCount(): number {
    return this.layer1Network.strategy.bridgeConfirmationBlockCount;
  }

  get isInProgress() {
    return !this.args.workflowSession.getValue('bridgeValidationResult');
  }

  get layer2BlockHeightBeforeBridging(): BN | null {
    return this.args.workflowSession.getValue(
      'layer2BlockHeightBeforeBridging'
    );
  }

  get showBridgingSubstate() {
    return this.blockCount <= this.totalBlockCount;
  }

  get bridgingSubstate() {
    if (this.blockCount === 0) return 'Waiting for transaction to be mined';
    else
      return `${this.blockCount} of ${this.totalBlockCount} blocks confirmed`;
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
