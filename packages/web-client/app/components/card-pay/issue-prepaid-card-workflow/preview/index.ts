import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { reads } from 'macro-decorators';
import { IWorkflowSession } from '@cardstack/web-client/models/workflow';
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
import { Safe } from '@cardstack/cardpay-sdk/sdk/safes';
import { TransactionOptions } from '@cardstack/cardpay-sdk';
import BN from 'bn.js';
import {
  ColorCustomizationOption,
  PatternCustomizationOption,
} from '../../../../services/card-customization';

interface CardPayPrepaidCardWorkflowPreviewComponentArgs {
  workflowSession: IWorkflowSession;
  onComplete: () => void;
  isComplete: boolean;
}

const A_WHILE = config.environment === 'test' ? 500 : 1000 * 10;

export default class CardPayPrepaidCardWorkflowPreviewComponent extends Component<CardPayPrepaidCardWorkflowPreviewComponentArgs> {
  @service declare cardCustomization: CardCustomization;
  @service declare layer2Network: Layer2Network;
  @tracked txnHash?: TransactionHash;
  @tracked chinInProgressMessage?: string;

  @reads('issueTask.last.error') declare error: Error | undefined;

  get faceValue(): number {
    return this.args.workflowSession.getValue('spendFaceValue')!;
  }

  @action issuePrepaidCard() {
    taskFor(this.issueTask)
      .perform()
      .catch((e) => console.error(e));
  }

  @action cancel() {
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

  get prepaidFundingSafe() {
    return this.args.workflowSession.getValue<Safe>('prepaidFundingSafe')!;
  }

  @action checkForPendingTransaction() {
    if (this.args.workflowSession.getValue('txnHash')) {
      taskFor(this.issueTask).perform();
    }
  }

  @task *issueTask(): TaskGenerator<void> {
    let { workflowSession } = this.args;
    try {
      let did = workflowSession.getValue<string>('did');

      if (!did) {
        this.chinInProgressMessage =
          'Preparing to create your custom prepaid card…';
        let issuerName = workflowSession.getValue<string>('issuerName')!;
        let colorSchemeId =
          workflowSession.getValue<ColorCustomizationOption>('colorScheme')!.id;
        let patternId =
          workflowSession.getValue<PatternCustomizationOption>('pattern')!.id;
        // yield statements require manual typing
        // https://github.com/machty/ember-concurrency/pull/357#discussion_r434850096
        let customization: Resolved<PrepaidCardCustomization> = yield taskFor(
          this.cardCustomization.createCustomizationTask
        ).perform({
          issuerName,
          colorSchemeId,
          patternId,
        });
        did = customization.did;

        workflowSession.setValue('did', did);
      }

      let txnHash = workflowSession.getValue<TransactionHash>('txnHash');
      if (txnHash && !workflowSession.getValue('prepaidCardAddress')) {
        this.chinInProgressMessage =
          'Waiting for the transaction to be finalized…';

        const prepaidCardSafe = yield taskFor(
          this.layer2Network.resumeIssuePrepaidCardTransactionTask
        ).perform(txnHash);

        this.args.workflowSession.setValue({
          prepaidCardAddress: prepaidCardSafe.address,
          reloadable: prepaidCardSafe.reloadable,
          transferrable: prepaidCardSafe.transferrable,
        });
      } else {
        this.chinInProgressMessage =
          'You will receive a confirmation request from the Card Wallet app in a few moments…';
        let options: TransactionOptions = {
          onTxnHash: (txnHash: TransactionHash) => {
            this.txnHash = txnHash;
            this.args.workflowSession.setValue('txnHash', txnHash);
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
        ).perform(
          this.faceValue,
          this.prepaidFundingSafe.address,
          did,
          options
        );

        let prepaidCardSafe = yield race([
          prepaidCardSafeTaskInstance,
          taskFor(this.timerTask).perform(),
        ]);
        this.issueTaskRunningForAWhile = false;

        this.args.workflowSession.setValue({
          prepaidCardAddress: prepaidCardSafe.address,
          reloadable: prepaidCardSafe.reloadable,
          transferrable: prepaidCardSafe.transferrable,
        });
      }

      this.args.onComplete();
    } catch (e) {
      let insufficientFunds = e.message.startsWith(
        'Safe does not have enough balance to make prepaid card(s).'
      );
      let tookTooLong = e.message.startsWith(
        'Transaction took too long to complete'
      );
      let unauthenticated = e.message.startsWith('No valid auth token');
      if (unauthenticated) {
        this.args.workflowSession?.workflow?.cancel('UNAUTHENTICATED');
        throw new Error('UNAUTHENTICATED');
      } else if (insufficientFunds) {
        // We probably want to cancel the workflow at this point
        // And tell the user to go deposit funds
        this.args.workflowSession?.workflow?.cancel('INSUFFICIENT_FUNDS');
        throw new Error('INSUFFICIENT_FUNDS');
      } else if (tookTooLong) {
        throw new Error('TIMEOUT');
      } else if (isLayer2UserRejectionError(e)) {
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
