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
        this.workflow?.animatedWrapper?.startTestWaiter();
        this.isComplete = false;
      }
    };
  }
  get session(): WorkflowSession | undefined {
    return this.workflow?.session;
  }

  @action onComplete() {
    this.isComplete = true;
    this.workflow?.animatedWrapper?.startTestWaiter();
  }
  @action onIncomplete() {
    this.workflow?.animatedWrapper?.startTestWaiter();
    this.workflow?.resetTo(this);
  }
}
