import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { reads } from 'macro-decorators';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import { task } from 'ember-concurrency';
import CardCustomization from '../../../../services/card-customization';
import HubAuthentication from '../../../../services/hub-authentication';
import Layer2Network from '../../../../services/layer2-network';

interface CardPayDepositWorkflowPreviewComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: () => void;
  isComplete: boolean;
}

export default class CardPayDepositWorkflowPreviewComponent extends Component<CardPayDepositWorkflowPreviewComponentArgs> {
  @service declare cardCustomization: CardCustomization;
  @service declare hubAuthentication: HubAuthentication;
  @service declare layer2Network: Layer2Network;

  @reads('args.workflowSession.state.spendFaceValue')
  declare faceValue: number;

  @task *issueTask() {
    let { workflowSession } = this.args;
    yield this.hubAuthentication.ensureAuthenticated();
    let customization = yield taskFor(
      this.cardCustomization.createCustomizationTask
    ).perform({
      issuerName: workflowSession.state.issuerName,
      colorSchemeId: workflowSession.state.colorScheme.id,
      patternId: workflowSession.state.pattern.id,
    });
    yield taskFor(this.layer2Network.issuePrepaidCard)
      .perform(this.faceValue, customization.did)
      .then((address: string) => {
        this.args.workflowSession.update('prepaidCardAddress', address);
        this.args.onComplete();
      });
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
}
