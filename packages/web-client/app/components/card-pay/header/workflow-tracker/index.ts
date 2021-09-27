import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import WorkflowPersistence, { WorkflowPersistencePersistedData } from '@cardstack/web-client/services/workflow-persistence';

interface CardPayHeaderWorkflowTrackerArgs {}

export default class CardPayHeaderWorkflowTracker extends Component<CardPayHeaderWorkflowTrackerArgs> {
  @service declare workflowPersistence: WorkflowPersistence;

  @tracked showing = false;

  get allWorkflows() {
    return this.workflowPersistence.persistedDataIds.map((id) => ({
      workflow: persistedDataWithParsedMeta(this.workflowPersistence.getPersistedData(id)),
      id,
    }));
  }

  get activeWorkflows() {
    return this.allWorkflows.filter(
      (workflow) =>
        workflow.workflow.state.meta.completedMilestonesCount < // FIXME workflow.workflow lol
        workflow.workflow.state.meta.milestonesCount
    );
  }

  get completedWorkflows() {
    return this.allWorkflows.filter(
      (workflow) =>
        workflow.workflow.state.meta.completedMilestonesCount ===
        workflow.workflow.state.meta.milestonesCount
    );
  }
}

// FIXME mutating, scandalous? And, can this be pushed farther up?
function persistedDataWithParsedMeta(data: WorkflowPersistencePersistedData) {
  data.state.meta = JSON.parse(data.state.meta).value;
  return data;
}
