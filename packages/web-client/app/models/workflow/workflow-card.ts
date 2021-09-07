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
  cardName?: string;
  author: Participant;
  componentName: string; // this should eventually become a card reference
  includeIf(this: WorkflowCard): boolean;
  check(this: WorkflowCard): Promise<CheckResult>;
}

export class WorkflowCard extends WorkflowPostable {
  cardName: string;
  componentName: string;
  check: (this: WorkflowCard) => Promise<CheckResult> = () => {
    return Promise.resolve({ success: true });
  };

  constructor(options: Partial<WorkflowCardOptions>) {
    super(options.author!, options.includeIf);
    this.componentName = options.componentName!;
    this.cardName = options.cardName || '';

    this.reset = () => {
      if (this.isComplete) {
        this.isComplete = false;
      }
    };
    if (options.check) {
      this.check = options.check;
    }
  }
  get session(): WorkflowSession | undefined {
    return this.workflow?.session;
  }

  @action async onComplete() {
    if (this.isComplete) return;
    let checkResult = await this.check();
    if (checkResult.success) {
      // visible-postables-will-change starts test waiters in animated-workflow.ts
      this.workflow?.emit('visible-postables-will-change');
      this.isComplete = true;
    } else {
      this.workflow?.cancel(checkResult.reason);
    }

    if (this.isComplete && this.cardName) {
      const existingCompletedCardNames =
        this.session?.state.completedCardNames || [];

      if (!existingCompletedCardNames.includes(this.cardName)) {
        this.session?.update('completedCardNames', [
          ...existingCompletedCardNames,
          this.cardName,
        ]);
      }
    }
  }

  @action onIncomplete() {
    this.workflow?.resetTo(this);
  }
}
