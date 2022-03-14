import { Milestone } from './workflow/milestone';
import PostableCollection from './workflow/postable-collection';
import { WorkflowPostable } from './workflow/workflow-postable';
import WorkflowSession, { IWorkflowSession } from './workflow/workflow-session';
import { tracked } from '@glimmer/tracking';
import { SimpleEmitter } from '../utils/events';
import WorkflowPersistence from '@cardstack/web-client/app/services/workflow-persistence';
import { setOwner } from '@ember/application';
export { Milestone } from './workflow/milestone';
export { default as PostableCollection } from './workflow/postable-collection';
export type { IWorkflowMessage } from './workflow/workflow-message';
export { WorkflowMessage } from './workflow/workflow-message';
export { default as NetworkAwareWorkflowMessage } from './workflow/network-aware-message';
export type {
  CheckResult,
  WorkflowCardComponentArgs,
} from './workflow/workflow-card';
export { WorkflowCard } from './workflow/workflow-card';
export { default as NetworkAwareWorkflowCard } from './workflow/network-aware-card';
export type { Participant } from './workflow/workflow-postable';
export { WorkflowPostable } from './workflow/workflow-postable';
export type {
  WorkflowSessionDictionary,
  IWorkflowSession,
} from './workflow/workflow-session';
export { default as WorkflowSession } from './workflow/workflow-session';
export { SessionAwareWorkflowMessage } from './workflow/session-aware-workflow-message';
export {
  conditionalCancelationMessage,
  defaultCancelationCard,
} from './workflow/cancelation-helpers';
import {
  COMPLETED_WORKFLOW_WITH_UNSUPPORTED_VERSION,
  INCOMPLETE_WORKFLOW_WITH_UNSUPPORTED_VERSION,
} from './workflow/standard-cancelation-reasons';

interface PostableIndices {
  isInMilestone: boolean;
  isInEpilogue: boolean;
  milestoneIndex: number | undefined;
  collectionIndex: number;
}

export type CardPayWorkflowName =
  | 'PREPAID_CARD_ISSUANCE'
  | 'RESERVE_POOL_DEPOSIT'
  | 'WITHDRAWAL'
  | 'MERCHANT_CREATION';

export type CardSpaceWorkflowName = 'CARD_SPACE_CREATION';

export type WorkflowName = CardPayWorkflowName | CardSpaceWorkflowName;
export abstract class Workflow {
  name!: WorkflowName;
  abstract version: number;
  milestones: Milestone[] = [];
  epilogue: PostableCollection = new PostableCollection();
  cancelationMessages: PostableCollection = new PostableCollection();
  @tracked isCanceled = false;
  @tracked cancelationReason: null | string = null;
  session: IWorkflowSession;
  owner: any;
  simpleEmitter = new SimpleEmitter();
  isRestored = false;
  workflowDisplayNames = WORKFLOW_NAMES;
  workflowPersistence: WorkflowPersistence;
  workflowPersistenceId?: string;

  restorationErrors(): string[] {
    let errors = [];
    let meta = this.session.getMeta();
    let persistedVersion = meta.version;
    let isComplete = meta.completedMilestonesCount === meta.milestonesCount;
    if (this.version > (persistedVersion ?? 0)) {
      if (isComplete) {
        errors.push(COMPLETED_WORKFLOW_WITH_UNSUPPORTED_VERSION);
      } else {
        errors.push(INCOMPLETE_WORKFLOW_WITH_UNSUPPORTED_VERSION);
      }
    }
    return errors;
  }

  abstract beforeRestorationChecks(): Promise<void>[];

  constructor(owner?: any, workflowPersistenceId?: string) {
    setOwner(this, owner);
    this.session = new WorkflowSession(this);
    this.workflowPersistence = owner.lookup('service:workflow-persistence');
    this.workflowPersistenceId = workflowPersistenceId;
  }

  async restore() {
    if (!this.session.hasPersistedState()) {
      return;
    }
    this.session.restoreFromStorage();
    await Promise.all(this.beforeRestorationChecks());
    let errors = this.restorationErrors();

    if (errors.length > 0) {
      this.cancel(errors[0]);
    } else {
      this.restoreFromPersistedWorkflow();
    }
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
    return Boolean(
      this.milestones.length &&
        this.completedMilestoneCount === this.milestones.length
    );
  }

  cancel(reason?: string | null) {
    const cancelationReason = reason || 'UNKNOWN';

    if (
      (!this.isComplete && !this.isCanceled) ||
      cancelationReason === COMPLETED_WORKFLOW_WITH_UNSUPPORTED_VERSION
    ) {
      this.session.setMeta({
        isCanceled: true,
        cancelationReason: cancelationReason,
      });
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

  restoreFromPersistedWorkflow() {
    this.session.restoreFromStorage();

    const [lastCompletedCardName] = (
      this.session.getMeta()?.completedCardNames || []
    ).slice(-1);

    if (lastCompletedCardName) {
      this.isRestored = true;
      const postables = this.milestones
        .flatMap((m: Milestone) => m.postableCollection.postables)
        .concat(this.epilogue.postables);

      const index = postables.mapBy('cardName').indexOf(lastCompletedCardName);

      postables.slice(0, index + 1).forEach((postable: WorkflowPostable) => {
        postable.isComplete = true;
      });
    }

    if (
      this.session.getMeta().isCanceled &&
      this.session.getMeta().cancelationReason
    ) {
      this.cancel(this.session.getMeta().cancelationReason);
    }
  }
}

export let cardbot = { name: 'Cardbot', imgURL: '/images/icons/cardbot.svg' };

export const CARD_PAY_WORKFLOW_NAMES = {
  PREPAID_CARD_ISSUANCE: 'Prepaid Card Issuance',
  MERCHANT_CREATION: 'Payment Profile Creation',
  RESERVE_POOL_DEPOSIT: 'Reserve Pool Deposit',
  WITHDRAWAL: 'Withdrawal',
};

export const CARD_SPACE_WORKFLOW_NAMES = {
  CARD_SPACE_CREATION: 'Card Space Creation',
};

export const WORKFLOW_NAMES = {
  ...CARD_PAY_WORKFLOW_NAMES,
  ...CARD_SPACE_WORKFLOW_NAMES,
};
