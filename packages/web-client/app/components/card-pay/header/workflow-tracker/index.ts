import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';

interface CardPayHeaderWorkflowTrackerArgs {}

export default class CardPayHeaderWorkflowTracker extends Component<CardPayHeaderWorkflowTrackerArgs> {
  @service declare workflowPersistence: WorkflowPersistence;

  @tracked showing = false;

  get allWorkflows() {
    return this.workflowPersistence.persistedDataIds.map((id) =>
      this.workflowPersistence.getPersistedData(id)
    );
  }

  get activeWorkflows() {
    return this.allWorkflows.filter(
      (workflow) =>
        workflow.state.completedMilestonesCount < workflow.state.milestonesCount
    );
  }

  get completedWorkflows() {
    return this.allWorkflows.filter(
      (workflow) =>
        workflow.state.completedMilestonesCount ===
        workflow.state.milestonesCount
    );
  }
}
