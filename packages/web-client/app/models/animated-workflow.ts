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
import config from '@cardstack/web-client/config/environment';
import { buildWaiter } from '@ember/test-waiters';
import RSVP, { defer } from 'rsvp';

let waiter = buildWaiter('thread-animation');
let token: any = null;
let waiting: RSVP.Deferred<void> | null = null;

let interval = config.environment === 'test' ? 100 : 1000;

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
      yield timeout(interval);
    }
  }

  revealNext() {
    if (this.isCanceled) {
      this.cancelationMessages.revealNext();
      return;
    }

    if (this.isComplete) {
      this.epilogue.revealNext();
      return;
    }

    for (const animatedMilestone of this.visibleMilestones) {
      if (animatedMilestone.revealNext()) {
        return;
      }
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

  async startTestWaiter() {
    if (token) {
      return;
    }
    token = waiter.beginAsync();
    waiting = defer();

    await waiting.promise;
    waiter.endAsync(token);

    token = null;
    waiting = null;
  }

  stopTestWaiter() {
    waiting?.resolve();
  }

  destroy() {
    taskFor(this.tickerTask).cancelAll();
  }
}
