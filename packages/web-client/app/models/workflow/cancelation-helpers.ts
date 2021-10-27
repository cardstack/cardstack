import { WorkflowMessage } from './workflow-message';
import { WorkflowCard, WorkflowCardOptions } from './workflow-card';
import { isPresent } from '@ember/utils';
import {
  COMPLETED_WORKFLOW_WITH_UNSUPPORTED_VERSION,
  INCOMPLETE_WORKFLOW_WITH_UNSUPPORTED_VERSION,
} from './standard-cancelation-reasons';

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

export function defaultCancelationCard(): WorkflowCard<WorkflowCardOptions> {
  return new WorkflowCard({
    componentName: 'workflow-thread/default-cancelation-cta',
    includeIf() {
      return isPresent(this.workflow?.cancelationReason);
    },
  });
}

export function standardCancelationPostables() {
  return [
    conditionalCancelationMessage({
      forReason: INCOMPLETE_WORKFLOW_WITH_UNSUPPORTED_VERSION,
      message:
        'You attempted to restore an unfinished workflow, but the workflow has been upgraded by the Cardstack development team since then, so you will need to start again. Sorry about that!',
    }),
    conditionalCancelationMessage({
      forReason: COMPLETED_WORKFLOW_WITH_UNSUPPORTED_VERSION,
      message:
        'This workflow has been upgraded by the Cardstack development team since then, so we’re not able to display it. Sorry about that!',
    }),
    defaultCancelationCard(),
  ];
}
