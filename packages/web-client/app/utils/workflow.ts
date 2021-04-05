import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
export interface Participant {
  name: string;
}

interface WorkflowMessageOptions {
  author: Participant;
  message: string;
}

class WorkflowPostable {
  author: Participant;
  @tracked isComplete: boolean = false;
  constructor(author: Participant) {
    this.author = author;
  }
}

export class WorkflowMessage extends WorkflowPostable {
  message: string;
  constructor(options: WorkflowMessageOptions) {
    super(options.author);
    this.message = options.message;
    this.isComplete = true;
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
  @action onComplete() {
    this.isComplete = true;
  }
}

interface MilestoneOptions {
  name: string;
  postables: WorkflowPostable[];
  completedDetail: string;
}
export class Milestone {
  name: string;
  postables: WorkflowPostable[] = [];
  get isComplete() {
    return this.postables.isEvery('isComplete', true);
  }
  completedDetail;

  constructor(opts: MilestoneOptions) {
    this.name = opts.name;
    this.postables = opts.postables;
    this.completedDetail = opts.completedDetail;
  }
}

export abstract class Workflow {
  name!: string;
  milestones: Milestone[] = [];
  get activeMilestoneIndex() {
    return this.milestones.filterBy('isComplete').length;
  }
}
