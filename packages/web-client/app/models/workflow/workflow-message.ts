import { Participant, WorkflowPostable } from './workflow-postable';

interface WorkflowMessageOptions {
  author: Participant;
  message: string;
  includeIf: () => boolean;
}

export class WorkflowMessage extends WorkflowPostable {
  message: string;
  constructor(options: Partial<WorkflowMessageOptions>) {
    super(options.author!, options.includeIf);
    this.message = options.message!;
    this.isComplete = true;
  }
}
