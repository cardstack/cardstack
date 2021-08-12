import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import MerchantCustomizationService, {
  MerchantCustomization,
} from '@cardstack/web-client/services/merchant-customization';
import { isLayer2UserRejectionError } from '@cardstack/web-client/utils/is-user-rejection-error';
import Resolved from '@cardstack/web-client/utils/resolved';
import {
  RegisterMerchantOptions,
  TransactionHash,
} from '@cardstack/web-client/utils/web3-strategies/types';

import { task, TaskGenerator } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { reads } from 'macro-decorators';

interface CardPayCreateMerchantWorkflowPrepaidCardChoiceComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: () => void;
  isComplete: boolean;
}

export default class CardPayCreateMerchantWorkflowPrepaidCardChoiceComponent extends Component<CardPayCreateMerchantWorkflowPrepaidCardChoiceComponentArgs> {
  @service declare merchantCustomization: MerchantCustomizationService;
  @service declare layer2Network: Layer2Network;

  @tracked chinInProgressMessage?: string;
  @tracked txHash?: TransactionHash;

  @reads('createTask.last.error') declare error: Error | undefined;

  @action createMerchant() {
    taskFor(this.createTask)
      .perform()
      .catch((e) => console.error(e));
  }

  @task *createTask(): TaskGenerator<void> {
    let { workflowSession } = this.args;

    try {
      this.chinInProgressMessage = 'Preparing to create merchant…';

      // yield statements require manual typing
      // https://github.com/machty/ember-concurrency/pull/357#discussion_r434850096
      let placeholderCustomization: Resolved<MerchantCustomization> = yield taskFor(
        this.merchantCustomization.createCustomizationTask
      ).perform();

      let options: RegisterMerchantOptions = {
        onTxHash: (txHash: TransactionHash) => {
          this.txHash = txHash;
          this.chinInProgressMessage =
            'Waiting for the transaction to be finalized…';
        },
      };

      let prepaidCards = (yield taskFor(
        this.layer2Network.refreshSafes
      ).perform()).filterBy('type', 'prepaid-card');
      let placeholderPrepaidCard = prepaidCards[0]!;

      let merchantSafe = yield taskFor(
        this.layer2Network.registerMerchant
      ).perform(
        placeholderPrepaidCard.address,
        placeholderCustomization.did,
        options
      );

      workflowSession.update('merchantSafe', merchantSafe);
      this.args.onComplete();
    } catch (e) {
      let insufficientFunds = e.message.startsWith(
        'Prepaid card does not have enough balance to register a merchant.'
      );
      let tookTooLong = e.message.startsWith(
        'Transaction took too long to complete'
      );
      if (insufficientFunds) {
        // This should only happen if the chosen prepaid card has been used
        // elsewhere as it should otherwise not be selectable.
        throw new Error('INSUFFICIENT_FUNDS');
      } else if (tookTooLong) {
        throw new Error('TIMEOUT');
      } else if (isLayer2UserRejectionError(e)) {
        throw new Error('USER_REJECTION');
      } else {
        throw e;
      }
    }
  }

  get creationState() {
    if (taskFor(this.createTask).isRunning) {
      return 'in-progress';
    } else if (this.args.isComplete) {
      return 'memorialized';
    } else {
      return 'default';
    }
  }

  get hasTriedCreatingMerchant() {
    return taskFor(this.createTask).performCount > 0;
  }

  get txViewerUrl() {
    return this.txHash && this.layer2Network.blockExplorerUrl(this.txHash);
  }
}
