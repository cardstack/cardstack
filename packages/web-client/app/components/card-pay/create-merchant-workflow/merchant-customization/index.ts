import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { reads } from 'macro-decorators';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import { task, TaskGenerator } from 'ember-concurrency';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { TransactionHash } from '@cardstack/web-client/utils/web3-strategies/types';
import { isLayer2UserRejectionError } from '@cardstack/web-client/utils/is-user-rejection-error';

interface CardPayCreateMerchantWorkflowMerchantCustomizationComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: () => void;
  isComplete: boolean;
}

export default class CardPayCreateMerchantWorkflowMerchantCustomizationComponent extends Component<CardPayCreateMerchantWorkflowMerchantCustomizationComponentArgs> {
  @service declare layer2Network: Layer2Network;
  @tracked txHash?: TransactionHash;

  @reads('args.workflowSession.state.spendFaceValue')
  declare faceValue: number;
  @reads('issueTask.last.error') declare error: Error | undefined;

  @action createMerchant() {
    taskFor(this.createTask)
      .perform()
      .catch((e) => console.error(e));
  }

  @task *createTask(): TaskGenerator<void> {
    let { workflowSession } = this.args;

    try {
      let prepaidCards = (yield taskFor(
        this.layer2Network.refreshSafes
      ).perform()).filterBy('type', 'prepaid-card');
      let placeholderPrepaidCard = prepaidCards[0]!;

      let merchantSafe = yield taskFor(
        this.layer2Network.registerMerchant
      ).perform(placeholderPrepaidCard.address, 'PLACEHOLDER-info-did', {
        onTxHash: (txHash: TransactionHash) => {
          this.txHash = txHash;
        },
      });

      workflowSession.update('merchantSafe', merchantSafe);
      this.args.onComplete();
    } catch (e) {
      let insufficientFunds = e.message.startsWith(
        'Prepaid card does not have enough balance to register a merchant.'
      );
      if (insufficientFunds) {
        // We probably want to cancel the workflow at this point
        // And tell the user to go deposit funds
        throw new Error('INSUFFICIENT_FUNDS');
      } else if (isLayer2UserRejectionError(e)) {
        throw new Error('USER_REJECTION');
      } else {
        // Basically, for pretty much everything we want to make the user retry or seek support
        throw e;
      }
    }
  }

  get createState() {
    if (taskFor(this.createTask).isRunning) {
      return 'in-progress';
    } else if (this.args.isComplete) {
      return 'memorialized';
    } else {
      return 'default';
    }
  }

  get hasTriedCreatingMerchantCard() {
    return taskFor(this.createTask).performCount > 0;
  }

  get txViewerUrl() {
    return this.txHash && this.layer2Network.blockExplorerUrl(this.txHash);
  }
}
