import { action } from '@ember/object';
import { Participant, WorkflowPostable } from './workflow-postable';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';

export interface WorkflowCardComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: (() => void) | undefined;
  onIncomplete: (() => void) | undefined;
  isComplete: boolean;
}

type SuccessCheckResult = {
  success: true;
};
type FailureCheckResult = {
  success: false;
  reason: string;
};
export type CheckResult = SuccessCheckResult | FailureCheckResult;

interface WorkflowCardOptions {
  author: Participant;
  componentName: string; // this should eventually become a card reference
  includeIf(this: WorkflowCard): boolean;
  check(this: WorkflowCard): Promise<CheckResult>;
}

export class WorkflowCard extends WorkflowPostable {
  componentName: string;
  check?: (this: WorkflowCard) => Promise<CheckResult>;

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
          // visible-postables-will-change starts test waiters in animated-workflow.ts
          this.workflow?.emit('visible-postables-will-change');
          this.isComplete = true;
        } else {
          this.workflow?.cancel(checkResult.reason);
        }
      });
    } else {
      this.workflow?.emit('visible-postables-will-change');
      this.isComplete = true;
    }
  }
  @action onIncomplete() {
    this.workflow?.resetTo(this);
  }
}
