import { Milestone } from './workflow/milestone';
import { WorkflowPostable } from './workflow/workflow-postable';

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

  peekAtVisiblePostables() {
    let result: WorkflowPostable[] = [];
    for (const milestone of this.milestones) {
      result = result.concat(milestone.peekAtVisiblePostables());
    }
    return result;
  }
}
