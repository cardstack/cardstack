import {
  ArbitraryDictionary,
  IWorkflowMessage,
  Participant,
  WorkflowPostable,
} from '@cardstack/web-client/models/workflow';

interface SessionAwareWorkflowMessageOptions {
  author: Participant;
  includeIf: (this: WorkflowPostable) => boolean;
  template: (session: ArbitraryDictionary) => string;
}

export class SessionAwareWorkflowMessage
  extends WorkflowPostable
  implements IWorkflowMessage
{
  private template: (session: ArbitraryDictionary) => string;
  isComplete = true;

  constructor(options: SessionAwareWorkflowMessageOptions) {
    super(options.author, options.includeIf);
    this.template = options.template;
  }

  get message() {
    return this.template(this.workflow?.session.state!);
  }
}
