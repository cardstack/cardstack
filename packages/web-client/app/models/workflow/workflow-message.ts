import { Participant, WorkflowPostable } from './workflow-postable';

interface WorkflowMessageOptions {
  author: Participant;
  message: string;
  includeIf: (this: WorkflowMessage) => boolean;
}

export interface IWorkflowMessage extends WorkflowPostable {
  message: string;
}

export class WorkflowMessage
  extends WorkflowPostable
  implements IWorkflowMessage
{
  message: string;

  constructor(options: Partial<WorkflowMessageOptions>) {
    super(options.author, options.includeIf);
    this.message = options.message!;
    this.isComplete = true;
  }
}
