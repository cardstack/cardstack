import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import config from '@cardstack/web-client/config/environment';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import MerchantInfoService from '@cardstack/web-client/services/merchant-info';
import { isLayer2UserRejectionError } from '@cardstack/web-client/utils/is-user-rejection-error';
import {
  RegisterMerchantOptions,
  TransactionHash,
} from '@cardstack/web-client/utils/web3-strategies/types';

import {
  race,
  rawTimeout,
  task,
  TaskGenerator,
  waitForProperty,
} from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { reads } from 'macro-decorators';

interface CardPayCreateMerchantWorkflowPrepaidCardChoiceComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: () => void;
  isComplete: boolean;
}

const A_WHILE = config.environment === 'test' ? 500 : 1000 * 10;

export default class CardPayCreateMerchantWorkflowPrepaidCardChoiceComponent extends Component<CardPayCreateMerchantWorkflowPrepaidCardChoiceComponentArgs> {
  @service declare merchantInfo: MerchantInfoService;
  @service declare layer2Network: Layer2Network;
  @reads('createTask.last.error') declare error: Error | undefined;
  @reads('args.workflowSession.state.merchantRegistrationFee')
  declare merchantRegistrationFee: number;

  @tracked chinInProgressMessage?: string;
  @tracked txHash?: TransactionHash;
  @tracked createTaskRunningForAWhile = false;

  lastNonce?: string;

  constructor(
    owner: unknown,
    args: CardPayCreateMerchantWorkflowPrepaidCardChoiceComponentArgs
  ) {
    super(owner, args);
  }

  @action createMerchant() {
    taskFor(this.createTask)
      .perform()
      .catch((e) => console.error(e));
  }

  @action cancel() {
    taskFor(this.createTask).cancelAll();
  }

  @task *createTask(): TaskGenerator<void> {
    let { workflowSession } = this.args;

    try {
      this.chinInProgressMessage = 'Preparing to create merchant…';

      if (!workflowSession.state.merchantInfo) {
        let persistedMerchantInfo = yield taskFor(
          this.merchantInfo.persistMerchantInfoTask
        ).perform({
          name: workflowSession.state.merchantName,
          slug: workflowSession.state.merchantId,
          color: workflowSession.state.merchantBgColor,
          textColor: workflowSession.state.merchantTextColor,
        });

        workflowSession.update('merchantInfo', persistedMerchantInfo);
      }

      let options: RegisterMerchantOptions = {
        onTxHash: (txHash: TransactionHash) => {
          this.txHash = txHash;
          this.chinInProgressMessage =
            'Waiting for the transaction to be finalized…';
        },
      };

      if (this.lastNonce) {
        options.nonce = this.lastNonce;
      } else {
        options.onNonce = (nonce: string) => {
          this.lastNonce = nonce;
        };
      }

      // await this.layer2Network.safes.value doesn’t trigger a fetch
      yield this.layer2Network.safes.fetch();

      let safes = this.layer2Network.safes.value;
      let prepaidCards = safes.filterBy('type', 'prepaid-card');
      let placeholderPrepaidCard = prepaidCards[0]!;

      let registerMerchantTaskInstance = taskFor(
        this.layer2Network.registerMerchant
      ).perform(
        placeholderPrepaidCard.address,
        workflowSession.state.merchantInfo.did,
        options
      );

      let merchantSafe = yield race([
        registerMerchantTaskInstance,
        taskFor(this.timerTask).perform(),
      ]);

      workflowSession.update('merchantSafe', merchantSafe);

      this.createTaskRunningForAWhile = false;

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
  @task *timerTask(): TaskGenerator<void> {
    this.createTaskRunningForAWhile = false;
    yield rawTimeout(A_WHILE);
    this.createTaskRunningForAWhile = true;
    yield waitForProperty(this, 'createTaskRunningForAWhile', false);
  }

  get enableCancelation() {
    return (
      taskFor(this.createTask).isRunning &&
      this.createTaskRunningForAWhile &&
      !this.txHash
    );
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
