import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
export interface Participant {
  name: string;
}

interface WorkflowMessageOptions {
  author: Participant;
  message: string;
}

export class WorkflowPostable {
  author: Participant;
  timestamp: Date | null = null;
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
  title: string;
  postables: WorkflowPostable[];
  completedDetail: string;
}
export class Milestone {
  title: string;
  postables: WorkflowPostable[] = [];
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

      postablesArr.push(post);

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
  get completedMilestoneCount() {
    return this.milestones.filterBy('isComplete').length;
  }
  get progressStatus() {
    let completedMilestones = this.milestones.filterBy('isComplete');
    let lastMilestone = completedMilestones[completedMilestones.length - 1];
    return lastMilestone?.completedDetail ?? 'Workflow Started';
  }
}
