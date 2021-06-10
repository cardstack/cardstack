import { action } from '@ember/object';
import { Participant, WorkflowPostable } from './workflow-postable';
import WorkflowSession from './workflow-session';

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
  get session(): WorkflowSession | undefined {
    return this.workflow?.session;
  }

  @action onComplete() {
    this.workflow?.emit('visible-postables-changed');
    this.isComplete = true;
  }
  @action onIncomplete() {
    this.workflow?.resetTo(this);
  }
}
