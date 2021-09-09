import { Milestone } from './workflow/milestone';
import PostableCollection from './workflow/postable-collection';
import { WorkflowPostable } from './workflow/workflow-postable';
import WorkflowSession from './workflow/workflow-session';
import { tracked } from '@glimmer/tracking';
import { SimpleEmitter } from '../utils/events';

interface PostableIndices {
  isInMilestone: boolean;
  isInEpilogue: boolean;
  milestoneIndex: number | undefined;
  collectionIndex: number;
}

export type WorkflowName =
  | 'PREPAID_CARD_ISSUANCE'
  | 'RESERVE_POOL_DEPOSIT'
  | 'WITHDRAWAL'
  | 'MERCHANT_CREATION';

export abstract class Workflow {
  name!: WorkflowName;
  milestones: Milestone[] = [];
  epilogue: PostableCollection = new PostableCollection();
  cancelationMessages: PostableCollection = new PostableCollection();
  @tracked isCanceled = false;
  @tracked cancelationReason: null | string = null;
  session: WorkflowSession;
  owner: any;
  simpleEmitter = new SimpleEmitter();
  isRestored = false;
  workflowDisplayNames = WORKFLOW_NAMES;

  constructor(owner: any) {
    this.owner = owner;
    this.session = new WorkflowSession(this);
  }

  attachWorkflow() {
    this.milestones.invoke('setWorkflow', this);
    this.epilogue.setWorkflow(this);
    this.cancelationMessages.setWorkflow(this);
  }

  get displayName() {
    return WORKFLOW_NAMES[this.name];
  }

  get completedMilestones() {
    let milestones = [];
    for (let i = 0; i < this.milestones.length; i++) {
      let milestone = this.milestones[i];
      if (milestone.isComplete) {
        milestones.push(milestone);
      } else {
        break;
      }
    }
    return milestones;
  }

  get completedMilestoneCount() {
    return this.completedMilestones.length;
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
    return this.completedMilestoneCount === this.milestones.length;
  }

  cancel(reason?: string) {
    const cancelationReason = reason || 'UNKNOWN';

    this.session.updateMany({
      isCancelled: true,
      cancelationReason: cancelationReason,
    });

    if (!this.isComplete && !this.isCanceled) {
      // visible-postables-will-change starts test waiters in animated-workflow.ts
      this.emit('visible-postables-will-change');
      this.cancelationReason = cancelationReason;
      this.isCanceled = true;
    }
  }

  get progressStatus() {
    let { completedMilestones } = this;
    let lastMilestone = completedMilestones[completedMilestones.length - 1];
    if (this.isCanceled) return 'Workflow canceled';
    else return lastMilestone?.completedDetail ?? 'Workflow started';
  }

  peekAtVisiblePostables() {
    let result: WorkflowPostable[] = [];
    for (const milestone of this.milestones) {
      result = result.concat(milestone.peekAtVisiblePostables());
      if (!milestone.isComplete) break;
    }
    if (this.isComplete) {
      result = result.concat(this.epilogue.peekAtVisiblePostables());
    } else if (this.isCanceled) {
      result = result.concat(this.cancelationMessages.peekAtVisiblePostables());
    }
    return result;
  }

  // invoked when we want to revert the workflow back to a particular, formerly complete postable
  resetTo(postable: WorkflowPostable) {
    let location = this.locatePostable(postable);
    this.emit('reset-postables', postable);
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

  on(event: string, cb: Function) {
    return this.simpleEmitter.on(event, cb);
  }

  emit(event: string, ...args: any[]) {
    this.simpleEmitter.emit(event, ...args);
  }
}

export let cardbot = { name: 'Cardbot', imgURL: '/images/icons/cardbot.svg' };

export const WORKFLOW_NAMES = {
  PREPAID_CARD_ISSUANCE: 'Prepaid Card Issuance',
  MERCHANT_CREATION: 'Merchant Creation',
  RESERVE_POOL_DEPOSIT: 'Reserve Pool Deposit',
  WITHDRAWAL: 'Withdrawal',
};
