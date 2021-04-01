export interface Participant {
  name: string;
}

interface WorkflowMessageOptions {
  author: Participant;
  message: string;
}

class WorkflowPostable {
  author: Participant;
  constructor(author: Participant) {
    this.author = author;
  }
}

export class WorkflowMessage extends WorkflowPostable {
  message: string;
  constructor(options: WorkflowMessageOptions) {
    super(options.author);
    this.message = options.message;
  }
}

interface WorkflowCardOptions {
  author: Participant;
  componentName: string; // this should eventually become a card reference
}

export class WorkflowCard extends WorkflowPostable {
  componentName: string;
  constructor(options: WorkflowCardOptions) {
    super(options.author);
    this.componentName = options.componentName;
  }
}

export class Milestone {
  name: string;
  postables: WorkflowPostable[] = [];
  complete = false;
  statusOnCompletion = 'TBD';
  completionMessage = 'TBD';

  constructor(name: string, postables: WorkflowPostable[]) {
    this.name = name;
    this.postables = postables;
  }
}

export abstract class Workflow {
  name!: string;
  milestones: Milestone[] = [];
  activeMilestoneIndex = 0;
}
