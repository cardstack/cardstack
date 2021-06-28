import { action } from '@ember/object';
import { Participant, WorkflowPostable } from './workflow-postable';
import WorkflowSession from './workflow-session';

interface WorkflowCheckOptions {
  author: Participant;
  componentName: string; // this should eventually become a card reference
  includeIf: () => boolean;
  check: () => Promise<boolean>;
  failureReason: string;
}

export class WorkflowCheck extends WorkflowPostable {
  check: () => Promise<boolean>;
  failureReason: string;
  _isCheck = true;

  constructor(options: Partial<WorkflowCheckOptions>) {
    super(options.author!, options.includeIf);
    if (!options.check || !options.failureReason) {
      throw new Error(
        'Workflow check used without providing a callback or failure reason'
      );
    }
    this.reset = () => {
      if (this.isComplete) {
        this.isComplete = false;
      }
    };
    this.failureReason = options.failureReason;
    this.check = options.check;
  }

  @action cancel() {
    this.workflow?.cancel(this.failureReason);
  }

  get session(): WorkflowSession | undefined {
    return this.workflow?.session;
  }

  @action onComplete() {
    this.workflow?.emit('visible-postables-changed');
    this.isComplete = true;
  }
}
