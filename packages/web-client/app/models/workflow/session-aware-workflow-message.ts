import {
  IWorkflowMessage,
  IWorkflowSession,
  Participant,
  WorkflowPostable,
} from '@cardstack/web-client/models/workflow';

interface SessionAwareWorkflowMessageOptions {
  author?: Participant;
  includeIf: (this: WorkflowPostable) => boolean;
  template: (session: IWorkflowSession) => string;
}

export class SessionAwareWorkflowMessage
  extends WorkflowPostable
  implements IWorkflowMessage
{
  private template: (session: IWorkflowSession) => string;
  isComplete = true;

  constructor(options: SessionAwareWorkflowMessageOptions) {
    super(options.author, options.includeIf);
    this.template = options.template;
  }

  get message() {
    if (!this.workflow) {
      return '';
    }
    return this.template(this.workflow.session);
  }
}
