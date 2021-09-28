import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

import WorkflowPersistence, {
  WorkflowPersistencePersistedData,
} from '@cardstack/web-client/services/workflow-persistence';
import { WORKFLOW_NAMES } from '@cardstack/web-client/models/workflow';

interface CardPayHeaderWorkflowTrackerArgs {}

interface WorkflowPersistencePersistedDataAndId {
  workflow: WorkflowPersistencePersistedData;
  id: string;
}

const WORKFLOW_NAMES_KEYS = Object.keys(WORKFLOW_NAMES);

export default class CardPayHeaderWorkflowTracker extends Component<CardPayHeaderWorkflowTrackerArgs> {
  @service declare workflowPersistence: WorkflowPersistence;

  @tracked showing = false;

  get allWorkflows() {
    return this.workflowPersistence.persistedDataIds.reduce((workflows, id) => {
      let workflow = this.workflowPersistence.getPersistedData(id);

      if (
        workflow &&
        WORKFLOW_NAMES_KEYS.includes(workflow.name) &&
        workflow.state &&
        workflow.state.meta
      ) {
        workflows.push({ workflow: persistedDataWithParsedMeta(workflow), id });
      }

      return workflows;
    }, [] as WorkflowPersistencePersistedDataAndId[]);
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

  @action clearCompletedWorkflows() {
    this.completedWorkflows.forEach((workflowAndId) => {
      this.workflowPersistence.clearWorkflowWithId(workflowAndId.id);
    });
  }
}

// FIXME mutating, scandalous? And, can this be pushed farther up?
function persistedDataWithParsedMeta(data: WorkflowPersistencePersistedData) {
  data.state.meta = JSON.parse(data.state.meta).value;
  return data;
}
