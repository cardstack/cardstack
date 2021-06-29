import { action } from '@ember/object';
import { Participant, WorkflowPostable } from './workflow-postable';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';

export interface WorkflowCardComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: (() => void) | undefined;
  onIncomplete: (() => void) | undefined;
  isComplete: boolean;
}

interface WorkflowCardOptions {
  author: Participant;
  componentName: string; // this should eventually become a card reference
  includeIf: () => boolean;
  check?: () => Promise<boolean>;
  failureReason: string;
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
    if (options.check && !options.failureReason) {
      throw new Error(
        'If providing the check option in a WorkflowCard, you should also be providing a failureReason'
      );
    }
    this.check = options.check ?? (async () => true);
    this.failureReason = options.failureReason;
  }
  get session(): WorkflowSession | undefined {
    return this.workflow?.session;
  }

  @action onComplete() {
    this.check!().then((successful) => {
      if (successful) {
        this.workflow?.emit('visible-postables-changed');
        this.isComplete = true;
      } else {
        this.workflow?.cancel(this.failureReason);
      }
    });
  }
  @action onIncomplete() {
    this.workflow?.resetTo(this);
  }
}
