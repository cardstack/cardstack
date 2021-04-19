import { A } from '@ember/array';
import { Milestone } from './workflow/milestone';
import PostableCollection from './workflow/postable-collection';
import { WorkflowPostable } from './workflow/workflow-postable';

export abstract class Workflow {
  name!: string;
  milestones: Milestone[] = [];
  epilogue: PostableCollection = new PostableCollection();
  owner: any;

  constructor(owner: any) {
    this.owner = owner;
  }

  attachWorkflow() {
    this.milestones.invoke('setWorkflow', this);
    this.epilogue.setWorkflow(this);
  }

  get completedMilestoneCount() {
    return this.milestones.filterBy('isComplete').length;
  }

  get isComplete() {
    return A(this.milestones).isEvery('isComplete');
  }

  get progressStatus() {
    let completedMilestones = this.milestones.filterBy('isComplete');
    let lastMilestone = completedMilestones[completedMilestones.length - 1];
    return lastMilestone?.completedDetail ?? 'Workflow Started';
  }

  peekAtVisiblePostables() {
    let result: WorkflowPostable[] = [];
    for (const milestone of this.milestones) {
      result = result.concat(milestone.peekAtVisiblePostables());
    }
    if (this.isComplete) {
      result = result.concat(this.epilogue.peekAtVisiblePostables());
    }
    return result;
  }
}
