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
}
