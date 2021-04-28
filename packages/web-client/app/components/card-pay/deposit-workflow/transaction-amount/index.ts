import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import Layer1Network from '../../../../services/layer1-network';
import Layer2Network from '../../../../services/layer2-network';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import { TransactionReceipt } from 'web3-core';

interface CardPayDepositWorkflowTransactionAmountComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: () => void;
}

class CardPayDepositWorkflowTransactionAmountComponent extends Component<CardPayDepositWorkflowTransactionAmountComponentArgs> {
  @tracked amount = 0;
  @tracked isUnlocked = false;
  @tracked isUnlocking = false;
  @tracked isDepositing = false;
  @tracked unlockTxnReceipt: TransactionReceipt | undefined;
  @tracked depositTxnReceipt: TransactionReceipt | undefined;
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;

  get isUnlockButtonDisabled() {
    return this.amount <= 0 || this.isUnlocked;
  }

  get isDepositButtonDisabled() {
    return !this.isUnlocked;
  }

  get unlockTxnViewerUrl() {
    return this.layer1Network.txnViewerUrl(
      this.unlockTxnReceipt?.transactionHash
    );
  }

  get depositTxnViewerUrl() {
    return this.layer1Network.txnViewerUrl(
      this.depositTxnReceipt?.transactionHash
    );
  }

  @action unlock() {
    let tokenSymbol = this.args.workflowSession.state.depositSourceToken;
    this.isUnlocking = true;
    taskFor(this.layer1Network.approve)
      .perform(this.amount, tokenSymbol)
      .then((transactionReceipt: TransactionReceipt) => {
        this.isUnlocked = true;
        this.unlockTxnReceipt = transactionReceipt;
      })
      .finally(() => {
        this.isUnlocking = false;
      });
  }
  @action deposit() {
    let tokenSymbol = this.args.workflowSession.state.depositSourceToken;
    let layer2Address = this.layer2Network.walletInfo.firstAddress!;
    this.isDepositing = true;
    taskFor(this.layer1Network.relayTokens)
      .perform(this.amount, tokenSymbol, layer2Address)
      .then((transactionReceipt: TransactionReceipt) => {
        this.depositTxnReceipt = transactionReceipt;
        this.args.workflowSession.update(
          'depositTxnReceipt',
          transactionReceipt
        );
        this.args.onComplete();
      })
      .finally(() => {
        this.isDepositing = false;
      });
  }
}

export default CardPayDepositWorkflowTransactionAmountComponent;
