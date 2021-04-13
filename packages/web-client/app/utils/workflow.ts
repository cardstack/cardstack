import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
export interface Participant {
  name: string;
}

interface WorkflowMessageOptions {
  author: Participant;
  message: string;
  includeIf: () => boolean;
}

export class WorkflowPostable {
  author: Participant;
  timestamp: Date | null = null;
  workflow: Workflow | undefined;
  setWorkflow(wf: Workflow) {
    this.workflow = wf;
  }
  @tracked isComplete: boolean = false;
  constructor(author: Participant, includeIf: (() => boolean) | undefined) {
    this.author = author;
    this.includeIf = includeIf;
  }
  includeIf: (() => boolean) | undefined;
}

export class WorkflowMessage extends WorkflowPostable {
  message: string;
  constructor(options: Partial<WorkflowMessageOptions>) {
    super(options.author!, options.includeIf);
    this.message = options.message!;
    this.isComplete = true;
  }
}

interface WorkflowCardOptions {
  author: Participant;
  componentName: string; // this should eventually become a card reference
  includeIf: () => boolean;
}

export class WorkflowCard extends WorkflowPostable {
  componentName: string;
  constructor(options: Partial<WorkflowCardOptions>) {
    super(options.author!, options.includeIf);
    this.componentName = options.componentName!;
  }
  @action onComplete() {
    this.isComplete = true;
  }
}

interface MilestoneOptions {
  title: string;
  postables: WorkflowPostable[];
  completedDetail: string;
}
export class Milestone {
  title: string;
  postables: WorkflowPostable[] = [];
  excludedPostables: WorkflowPostable[] = [];
  workflow: Workflow | undefined;
  setWorkflow(wf: Workflow) {
    this.workflow = wf;
    this.postables.invoke('setWorkflow', wf);
  }
  get isComplete() {
    return this.postables.isEvery('isComplete', true);
  }
  completedDetail;

  constructor(opts: MilestoneOptions) {
    this.title = opts.title;
    this.postables = opts.postables;
    this.completedDetail = opts.completedDetail;
  }

  get visiblePostables() {
    let postablesArr = [];

    for (let i = 0; i < this.postables.length; i++) {
      let post = this.postables[i];
      if (!post.timestamp) {
        post.timestamp = new Date();
      }
      if (this.excludedPostables.includes(post)) {
        continue;
      }
      if (post.includeIf && post.includeIf() == false) {
        this.excludedPostables.push(post);
      } else {
        postablesArr.push(post);
      }

      if (!post.isComplete) {
        break;
      }
    }

    return postablesArr;
  }
}

export abstract class Workflow {
  name!: string;
  milestones: Milestone[] = [];
  epiloguePostables: WorkflowPostable[] = [];
  owner: any;
  constructor(owner: any) {
    this.owner = owner;
  }
  attachWorkflow() {
    this.milestones.invoke('setWorkflow', this);
    this.epiloguePostables.invoke('setWorkflow', this);
  }
  get completedMilestoneCount() {
    return this.milestones.filterBy('isComplete').length;
  }
  get progressStatus() {
    let completedMilestones = this.milestones.filterBy('isComplete');
    let lastMilestone = completedMilestones[completedMilestones.length - 1];
    return lastMilestone?.completedDetail ?? 'Workflow Started';
  }
}
