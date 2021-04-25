import { tracked } from '@glimmer/tracking';
import { Workflow } from '../workflow';

export interface Participant {
  name: string;
}
export class WorkflowPostable {
  author: Participant;
  timestamp: Date | null = null;
  workflow: Workflow | undefined;
  setWorkflow(wf: Workflow) {
    this.workflow = wf;
  }
  @tracked isComplete: boolean = false;
  constructor(
    author: Participant,
    includeIf: (() => boolean) | undefined = undefined
  ) {
    this.author = author;
    this.includeIf = includeIf;
  }
  includeIf: (() => boolean) | undefined;
  reset: (() => void) | undefined;
}
