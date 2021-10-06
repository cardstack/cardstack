import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';

interface CardPayHeaderWorkflowTrackerDropdownListArgs {}

export default class CardPayHeaderWorkflowTrackerDropdownList extends Component<CardPayHeaderWorkflowTrackerDropdownListArgs> {
  @service declare workflowPersistence: WorkflowPersistence;

  @action clearCompletedWorkflows() {
    this.workflowPersistence.completedWorkflows.forEach((workflowAndId) => {
      this.workflowPersistence.clearWorkflowWithId(workflowAndId.id);
    });
  }
}
