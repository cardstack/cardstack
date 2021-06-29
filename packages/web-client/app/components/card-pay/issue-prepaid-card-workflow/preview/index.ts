import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { reads } from 'macro-decorators';
import Layer2Network from '../../../../services/layer2-network';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';

interface CardPayDepositWorkflowPreviewComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: () => void;
  isComplete: boolean;
}

export default class CardPayDepositWorkflowPreviewComponent extends Component<CardPayDepositWorkflowPreviewComponentArgs> {
  @service declare layer2Network: Layer2Network;

  @reads('args.workflowSession.state.spendFaceValue')
  declare faceValue: number;

  @action async issue() {
    taskFor(this.layer2Network.issuePrepaidCard)
      .perform(this.faceValue)
      .then((address: string) => {
        this.args.workflowSession.update('prepaidCardAddress', address);
        this.args.onComplete();
      });
  }

  get issueState() {
    if (taskFor(this.layer2Network.issuePrepaidCard).isRunning) {
      return 'in-progress';
    } else if (this.args.isComplete) {
      return 'memorialized';
    } else {
      return 'default';
    }
  }
}
