import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { reads } from 'macro-decorators';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import { task, TaskGenerator } from 'ember-concurrency';
import CardCustomization, {
  PrepaidCardCustomization,
} from '@cardstack/web-client/services/card-customization';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { TransactionHash } from '@cardstack/web-client/utils/web3-strategies/types';
import { isLayer2UserRejectionError } from '@cardstack/web-client/utils/is-user-rejection-error';

// http://ember-concurrency.com/docs/typescript
// infer whether we should treat the return of a yield statement as a promise
type Resolved<T> = T extends PromiseLike<infer R> ? R : T;

interface CardPayPrepaidCardWorkflowPreviewComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: () => void;
  isComplete: boolean;
}

export default class CardPayPrepaidCardWorkflowPreviewComponent extends Component<CardPayPrepaidCardWorkflowPreviewComponentArgs> {
  @service declare cardCustomization: CardCustomization;
  @service declare layer2Network: Layer2Network;
  @tracked txHash?: TransactionHash;

  @reads('args.workflowSession.state.spendFaceValue')
  declare faceValue: number;
  @reads('issueTask.last.error') declare error: Error | undefined;

  @action issuePrepaidCard() {
    taskFor(this.issueTask)
      .perform()
      .catch((e) => console.error(e));
  }

  @task *issueTask(): TaskGenerator<void> {
    let { workflowSession } = this.args;
    try {
      // yield statements require manual typing
      // https://github.com/machty/ember-concurrency/pull/357#discussion_r434850096
      let customization: Resolved<PrepaidCardCustomization> = yield taskFor(
        this.cardCustomization.createCustomizationTask
      ).perform({
        issuerName: workflowSession.state.issuerName,
        colorSchemeId: workflowSession.state.colorScheme.id,
        patternId: workflowSession.state.pattern.id,
      });

      let prepaidCardSafe = yield taskFor(
        this.layer2Network.issuePrepaidCard
      ).perform(this.faceValue, customization.did, {
        onTxHash: (txHash: TransactionHash) => {
          this.txHash = txHash;
        },
      });

      this.args.workflowSession.updateMany({
        prepaidCardAddress: prepaidCardSafe.address,
        reloadable: prepaidCardSafe.reloadable,
        transferrable: prepaidCardSafe.transferrable,
      });

      this.args.workflowSession.update('prepaidCardSafe', prepaidCardSafe);
      this.args.onComplete();
    } catch (e) {
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
        throw new Error('USER_REJECTION');
      } else {
        // Basically, for pretty much everything we want to make the user retry or seek support
        throw e;
      }
    }
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

  get txViewerUrl() {
    return this.txHash && this.layer2Network.blockExplorerUrl(this.txHash);
  }
}
