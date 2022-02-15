import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import WorkflowPersistence from '@cardstack/ssr-web/services/workflow-persistence';

interface CardPayHeaderWorkflowTrackerArgs {}

export default class CardPayHeaderWorkflowTracker extends Component<CardPayHeaderWorkflowTrackerArgs> {
  @service declare workflowPersistence: WorkflowPersistence;

  @tracked showing = false;
}
