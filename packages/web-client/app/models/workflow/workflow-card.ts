import { action } from '@ember/object';
import { Participant, WorkflowPostable } from './workflow-postable';
import WorkflowSession from './workflow-session';

type SuccessCheckResult = {
  success: true;
};
type FailureCheckResult = {
  success: false;
  reason: string;
};
type CheckResult = SuccessCheckResult | FailureCheckResult;

interface WorkflowCardOptions {
  author: Participant;
  componentName: string; // this should eventually become a card reference
  includeIf: () => boolean;
  check(): Promise<CheckResult>;
}

export class WorkflowCard extends WorkflowPostable {
  componentName: string;
  check?: () => Promise<CheckResult>;

  constructor(options: Partial<WorkflowCardOptions>) {
    super(options.author!, options.includeIf);
    this.componentName = options.componentName!;
    this.reset = () => {
      if (this.isComplete) {
        this.isComplete = false;
      }
    };
    this.check = options.check;
  }
  get session(): WorkflowSession | undefined {
    return this.workflow?.session;
  }

  @action onComplete() {
    if (this.check) {
      this.check().then((checkResult) => {
        if (checkResult.success) {
          this.workflow?.emit('visible-postables-changed');
          this.isComplete = true;
        } else {
          this.workflow?.cancel(checkResult.reason);
        }
      });
    } else {
      this.workflow?.emit('visible-postables-changed');
      this.isComplete = true;
    }
  }
  @action onIncomplete() {
    this.workflow?.resetTo(this);
  }
}
