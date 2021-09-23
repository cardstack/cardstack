import Component from '@glimmer/component';
import { inject as service } from '@ember/service';

import WorkflowPersistence, {
  WorkflowPersistencePersistedData,
} from '@cardstack/web-client/services/workflow-persistence';
import {
  WorkflowName,
  WORKFLOW_NAMES,
} from '@cardstack/web-client/models/workflow';

interface CardPayHeaderWorkflowTrackerItemArgs {
  workflow: WorkflowPersistencePersistedData;
}

export default class CardPayHeaderWorkflowTrackerItem extends Component<CardPayHeaderWorkflowTrackerItemArgs> {
  @service declare workflowPersistence: WorkflowPersistence;

  get workflowName() {
    return (
      WORKFLOW_NAMES[this.args.workflow.name as WorkflowName] ||
      'Unknown workflow type'
    );
  }

  get workflowState() {
    return this.args.workflow.state;
  }

  get currentCardDisplayName() {
    return this.workflowState.currentCardDisplayName;
  }

  get isComplete() {
    return (
      this.workflowState.completedMilestonesCount ===
      this.workflowState.milestonesCount
    );
  }

  get fractionComplete() {
    return (
      this.workflowState.completedMilestonesCount /
      this.workflowState.milestonesCount
    );
  }
}
