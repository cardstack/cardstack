import { A } from '@ember/array';
import { Milestone } from './workflow/milestone';
import PostableCollection from './workflow/postable-collection';
import { WorkflowPostable } from './workflow/workflow-postable';
import WorkflowSession from './workflow/workflow-session';

interface PostableIndices {
  isInMilestone: boolean;
  isInEpilogue: boolean;
  milestoneIndex: number | undefined;
  collectionIndex: number;
}

export abstract class Workflow {
  name!: string;
  milestones: Milestone[] = [];
  epilogue: PostableCollection = new PostableCollection();
  session: WorkflowSession = new WorkflowSession();
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

  get visibleMilestones(): Milestone[] {
    let milestonesArr: Milestone[] = [];
    for (let i = 0; i < this.milestones.length; i++) {
      let milestone = this.milestones[i];
      milestonesArr.push(milestone);
      if (!milestone.isComplete) {
        break;
      }
    }
    return milestonesArr;
  }

  get isComplete() {
    return A(this.milestones).isEvery('isComplete');
  }

  get progressStatus() {
    let completedMilestones = this.milestones.filterBy('isComplete');
    let lastMilestone = completedMilestones[completedMilestones.length - 1];
    return lastMilestone?.completedDetail ?? 'Workflow started';
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

  // invoked when we want to revert the workflow back to a particular, formerly complete postable
  resetTo(postable: WorkflowPostable) {
    let location = this.locatePostable(postable);
    if (location.isInMilestone) {
      for (let i = location.milestoneIndex!; i < this.milestones.length; i++) {
        let milestone = this.milestones[i];
        let startingIndex =
          i == location.milestoneIndex ? location.collectionIndex : 0;
        milestone.resetFrom(startingIndex);
      }
    }
    this.epilogue.resetFrom(
      location.isInEpilogue ? location.collectionIndex : 0
    );
  }

  private locatePostable(postable: WorkflowPostable): PostableIndices {
    let result = {
      isInMilestone: false,
      isInEpilogue: false,
    } as PostableIndices;
    for (let i = 0; i < this.milestones.length; i++) {
      let milestone = this.milestones[i];
      let postIndex = milestone.indexOf(postable);
      if (postIndex > -1) {
        result.isInMilestone = true;
        result.milestoneIndex = i;
        result.collectionIndex = postIndex;
        break;
      }
    }
    let postIndexInEpilogue = this.epilogue.indexOf(postable);
    if (postIndexInEpilogue > -1) {
      result.isInEpilogue = true;
      result.collectionIndex = postIndexInEpilogue;
    }
    return result;
  }
}

export let cardbot = { name: 'Cardbot', imgURL: '/images/icons/cardbot.svg' };
