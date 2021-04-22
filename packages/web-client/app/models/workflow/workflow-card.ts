import { action } from '@ember/object';
import { Participant, WorkflowPostable } from './workflow-postable';

interface WorkflowCardOptions {
  author: Participant;
  componentName: string; // this should eventually become a card reference
  includeIf: () => boolean;
}

export class WorkflowCard extends WorkflowPostable {
  componentName: string;
  constructor(options: Partial<WorkflowCardOptions>) {
    super(options.author!, options.includeIf);
    this.componentName = options.componentName!;
    this.reset = () => {
      if (this.isComplete) {
        this.isComplete = false;
      }
    };
  }

  @action onComplete() {
    this.isComplete = true;
  }
  @action onIncomplete() {
    this.isComplete = false;
  }
}
