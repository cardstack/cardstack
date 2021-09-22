import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { reads } from 'macro-decorators';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import {
  task,
  TaskGenerator,
  rawTimeout,
  waitForProperty,
  race,
} from 'ember-concurrency';
import CardCustomization, {
  PrepaidCardCustomization,
} from '@cardstack/web-client/services/card-customization';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import Resolved from '@cardstack/web-client/utils/resolved';
import { TransactionHash } from '@cardstack/web-client/utils/web3-strategies/types';
import { isLayer2UserRejectionError } from '@cardstack/web-client/utils/is-user-rejection-error';
import config from '../../../../config/environment';
import { TransactionOptions } from '@cardstack/cardpay-sdk';
import BN from 'bn.js';
import RouterService from '@ember/routing/router-service';
import { next } from '@ember/runloop';

interface CardPayPrepaidCardWorkflowPreviewComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: () => void;
  isComplete: boolean;
}

const A_WHILE = config.environment === 'test' ? 500 : 1000 * 10;

export default class CardPayPrepaidCardWorkflowPreviewComponent extends Component<CardPayPrepaidCardWorkflowPreviewComponentArgs> {
  @service declare cardCustomization: CardCustomization;
  @service declare layer2Network: Layer2Network;
  @service declare router: RouterService;
  @tracked txnHash?: TransactionHash;
  @tracked chinInProgressMessage?: string;
  @tracked isUserRejection = false;

  @reads('args.workflowSession.state.spendFaceValue')
  declare faceValue: number;
  @reads('issueTask.last.error') declare error: Error | undefined;

  @action issuePrepaidCard() {
    taskFor(this.issueTask).perform();
  }

  @action cancel() {
    this.isUserRejection = true;
    taskFor(this.issueTask).cancelAll();
  }

  @tracked issueTaskRunningForAWhile = false;
  get enableCancelation() {
    return (
      taskFor(this.issueTask).isRunning &&
      this.issueTaskRunningForAWhile &&
      !this.txnHash
    );
  }

  lastNonce?: string;

  constructor(
    owner: unknown,
    args: CardPayPrepaidCardWorkflowPreviewComponentArgs
  ) {
    super(owner, args);
  }

  @action checkForPendingTransaction() {
    if (this.args.workflowSession.state.txnHash) {
      taskFor(this.issueTask)
        .perform()
        .catch((e) => console.error(e));
    }
  }

  get shouldRestartWorkflow() {
    return this.hasTriedCreatingPrepaidCard && !this.isUserRejection;
  }

  @action async restartWorkflow() {
    await this.router.transitionTo({
      queryParams: { flow: null, 'flow-id': null },
    });
    next(this, () => {
      this.router.transitionTo({
        queryParams: {
          flow: 'issue-prepaid-card',
        },
      });
    });
  }

  @task *issueTask(): TaskGenerator<void> {
    let { workflowSession } = this.args;
    try {
      let did;

      if (workflowSession.state.did) {
        did = workflowSession.state.did;
      } else {
        this.chinInProgressMessage =
          'Preparing to create your custom prepaid card…';
        // yield statements require manual typing
        // https://github.com/machty/ember-concurrency/pull/357#discussion_r434850096
        let customization: Resolved<PrepaidCardCustomization> = yield taskFor(
          this.cardCustomization.createCustomizationTask
        ).perform({
          issuerName: workflowSession.state.issuerName,
          colorSchemeId: workflowSession.state.colorScheme.id,
          patternId: workflowSession.state.pattern.id,
        });
        did = customization.did;

        this.args.workflowSession.update('did', did);
      }

      if (
        workflowSession.state.txnHash &&
        !workflowSession.state.prepaidCardSafe
      ) {
        const txnHash = workflowSession.state.txnHash;
        this.chinInProgressMessage =
          'Waiting for the transaction to be finalized…';

        const prepaidCardSafe = yield taskFor(
          this.layer2Network.resumeIssuePrepaidCardTransactionTask
        ).perform(txnHash);

        this.args.workflowSession.update('prepaidCardSafe', prepaidCardSafe);
      } else {
        this.chinInProgressMessage =
          'You will receive a confirmation request from the Card Wallet app in a few moments…';
        let options: TransactionOptions = {
          onTxnHash: (txnHash: TransactionHash) => {
            this.txnHash = txnHash;
            this.args.workflowSession.update('txnHash', txnHash);
            this.chinInProgressMessage =
              'Waiting for the transaction to be finalized…';
          },
        };
        if (this.lastNonce) {
          options.nonce = new BN(this.lastNonce);
        } else {
          options.onNonce = (nonce: BN) => {
            this.lastNonce = nonce.toString();
          };
        }

        let prepaidCardSafeTaskInstance = taskFor(
          this.layer2Network.issuePrepaidCardTask
        ).perform(this.faceValue, did, options);

        let prepaidCardSafe = yield race([
          prepaidCardSafeTaskInstance,
          taskFor(this.timerTask).perform(),
        ]);
        this.issueTaskRunningForAWhile = false;

        this.args.workflowSession.updateMany({
          prepaidCardAddress: prepaidCardSafe.address,
          reloadable: prepaidCardSafe.reloadable,
          transferrable: prepaidCardSafe.transferrable,
          prepaidCardSafe: prepaidCardSafe,
        });
      }

      this.args.onComplete();
    } catch (e) {
      this.isUserRejection = false;
      let insufficientFunds = e.message.startsWith(
        'Safe does not have enough balance to make prepaid card(s).'
      );
      let tookTooLong = e.message.startsWith(
        'Transaction took too long to complete'
      );
      if (insufficientFunds) {
        // We probably want to cancel the workflow at this point
        // And tell the user to go deposit funds
        throw new Error('INSUFFICIENT_FUNDS');
      } else if (tookTooLong) {
        throw new Error('TIMEOUT');
      } else if (isLayer2UserRejectionError(e)) {
        this.isUserRejection = true;
        throw new Error('USER_REJECTION');
      } else {
        // Basically, for pretty much everything we want to make the user retry or seek support
        throw e;
      }
    }
    this.issueTaskRunningForAWhile = false;
  }

  @task *timerTask(): TaskGenerator<void> {
    this.issueTaskRunningForAWhile = false;
    yield rawTimeout(A_WHILE);
    this.issueTaskRunningForAWhile = true;
    yield waitForProperty(this, 'issueTaskRunningForAWhile', false);
  }

  get issueState() {
    if (taskFor(this.issueTask).isRunning) {
      return 'in-progress';
    } else if (this.args.isComplete) {
      return 'memorialized';
    } else {
      return 'default';
    }
  }

  get hasTriedCreatingPrepaidCard() {
    return taskFor(this.issueTask).performCount > 0;
  }

  get txViewerUrl() {
    return this.txnHash && this.layer2Network.blockExplorerUrl(this.txnHash);
  }
}
