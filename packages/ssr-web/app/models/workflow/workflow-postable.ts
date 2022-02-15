import { tracked } from '@glimmer/tracking';
import { cardbot, Workflow } from '../workflow';

export interface Participant {
  name: string;
}
export class WorkflowPostable {
  author: Participant;
  timestamp: Date | null = null;
  @tracked workflow: Workflow | undefined;
  setWorkflow(wf: Workflow) {
    this.workflow = wf;
  }
  @tracked isComplete: boolean = false;
  constructor(
    author?: Participant,
    includeIf: ((this: WorkflowPostable) => boolean) | undefined = undefined
  ) {
    this.author = author || cardbot;
    this.includeIf = includeIf;
  }
  includeIf: (() => boolean) | undefined;
  reset: (() => void) | undefined;
  failureReason: string | undefined;
}
