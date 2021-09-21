import Component from '@glimmer/component';
import { inject as service } from '@ember/service';

import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import {
  WorkflowName,
  WORKFLOW_NAMES,
} from '@cardstack/web-client/models/workflow';

interface CardPayHeaderWorkflowTrackerItemArgs {
  workflowId: string;
}

export default class CardPayHeaderWorkflowTrackerItem extends Component<CardPayHeaderWorkflowTrackerItemArgs> {
  @service declare workflowPersistence: WorkflowPersistence;

  get persistedData() {
    return this.workflowPersistence.getPersistedData(this.args.workflowId);
  }

  get workflowName() {
    return (
      WORKFLOW_NAMES[this.persistedData.name as WorkflowName] ||
      'Unknown workflow type'
    );
  }
}
