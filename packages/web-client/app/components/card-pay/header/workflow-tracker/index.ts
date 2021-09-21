import Component from '@glimmer/component';
import { inject as service } from '@ember/service';

import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';

interface CardPayHeaderWorkflowTrackerArgs {}

export default class CardPayHeaderWorkflowTracker extends Component<CardPayHeaderWorkflowTrackerArgs> {
  @service declare workflowPersistence: WorkflowPersistence;

  get activeWorkflows() {
    return this.workflowPersistence.persistedDataIds;
  }
}
