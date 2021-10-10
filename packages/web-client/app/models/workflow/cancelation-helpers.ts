import { WorkflowMessage } from './workflow-message';
import { WorkflowCard } from './workflow-card';
import { isPresent } from '@ember/utils';

interface CancelationMessageArgs {
  forReason: string;
  message: string;
}

export function conditionalCancelationMessage({
  forReason: reason,
  message,
}: CancelationMessageArgs): WorkflowMessage {
  return new WorkflowMessage({
    message,
    includeIf() {
      return this.workflow?.cancelationReason === reason;
    },
  });
}

export function defaultCancelationCard(): WorkflowCard {
  return new WorkflowCard({
    componentName: 'workflow-thread/default-cancelation-cta',
    includeIf() {
      return isPresent(this.workflow?.cancelationReason);
    },
  });
}
