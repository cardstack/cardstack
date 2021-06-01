import { Workflow } from './workflow';
import { reads } from 'macro-decorators';
import { Milestone } from './workflow/milestone';
import PostableCollection from './workflow/postable-collection';
import { WorkflowPostable } from './workflow/workflow-postable';
import { tracked } from '@glimmer/tracking';
import { taskFor } from 'ember-concurrency-ts';
import { task } from 'ember-concurrency-decorators';
import { timeout } from 'ember-concurrency';
import { A } from '@ember/array';

class AnimatedMilestone {
  model: Milestone;
  @reads('model.completedDetail') declare completedDetail: string;
  @reads('model.title') declare title: string;
  @tracked isCompletionRevealed = false;
  @reads('postableCollection.visiblePostables')
  declare visiblePostables: WorkflowPostable[];
  postableCollection: AnimatedPostableCollection;

  constructor(model: Milestone) {
    this.model = model;
    this.postableCollection = new AnimatedPostableCollection(
      model.postableCollection
    );
  }

  revealNext(): boolean {
    let revealed = this.postableCollection.revealNext();
    if (!revealed && !this.isCompletionRevealed) {
      revealed = true;
      this.isCompletionRevealed = true;
    }
    return revealed;
  }

  get isComplete(): boolean {
    return this.postableCollection.isComplete && this.isCompletionRevealed;
  }
}

class AnimatedPostableCollection {
  model: PostableCollection;
  @tracked revealPointer: WorkflowPostable | undefined;

  constructor(model: PostableCollection) {
    this.model = model;
  }

  get visiblePostables(): WorkflowPostable[] {
    let result = [] as WorkflowPostable[];
    if (!this.revealPointer) return result;
    for (const postable of this.model.visiblePostables) {
      result.push(postable);
      if (postable === this.revealPointer) {
        break;
      }
    }
    return result;
  }

  revealNext(): boolean {
    let postables = this.model.visiblePostables;
    let index = this.revealPointer
      ? postables.indexOf(this.revealPointer!)
      : -1;
    if (index === postables.length - 1) {
      return false;
    }
    this.revealPointer = postables[index + 1];
    return true;
  }

  get isComplete() {
    if (!this.model.isComplete) {
      return false;
    }
    let postables = this.model.visiblePostables;
    let index = this.revealPointer
      ? postables.indexOf(this.revealPointer!)
      : -1;
    return index === postables.length - 1;
  }
}

export default class AnimatedWorkflow {
  model: Workflow;
  epilogue: AnimatedPostableCollection;
  cancelationMessages: AnimatedPostableCollection;
  milestones: AnimatedMilestone[];

  constructor(model: Workflow) {
    this.model = model;
    this.epilogue = new AnimatedPostableCollection(model.epilogue);
    this.cancelationMessages = new AnimatedPostableCollection(
      model.cancelationMessages
    );
    this.milestones = model.milestones.map((m) => new AnimatedMilestone(m));
    taskFor(this.tickerTask).perform();
  }
  @reads('model.name') declare name: string;

  @task
  *tickerTask() {
    while (true) {
      this.revealNext();
      yield timeout(3000); // TODO: shorten?
    }
  }

  revealNext() {
    let revealed = false;
    if (this.isCanceled) {
      this.cancelationMessages.revealNext();
      return;
    }
    for (const animatedMilestone of this.visibleMilestones) {
      if (animatedMilestone.revealNext()) {
        break;
      }
    }
    if (!revealed) {
      this.epilogue.revealNext();
    }
  }

  get visibleMilestones(): AnimatedMilestone[] {
    let underlyingVisibleMilestones = this.model.visibleMilestones;
    return this.milestones.filter((m) => {
      return underlyingVisibleMilestones.includes(m.model);
    });
  }

  get isCanceled() {
    return this.model.isCanceled;
  }

  get isComplete() {
    return A(this.milestones).isEvery('isComplete');
  }

  get completedMilestoneCount() {
    return this.milestones.filterBy('isComplete').length;
  }

  get progressStatus() {
    let completedMilestones = this.milestones.filterBy('isComplete');
    let lastMilestone = completedMilestones[completedMilestones.length - 1];
    return lastMilestone?.completedDetail ?? 'Workflow started';
  }

  destroy() {
    taskFor(this.tickerTask).cancelAll();
  }
}
