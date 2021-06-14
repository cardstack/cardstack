import { Workflow } from './workflow';
import { reads } from 'macro-decorators';
import { Milestone } from './workflow/milestone';
import PostableCollection from './workflow/postable-collection';
import { WorkflowPostable } from './workflow/workflow-postable';
import { tracked } from '@glimmer/tracking';
import { taskFor } from 'ember-concurrency-ts';
import { task } from 'ember-concurrency-decorators';
import { rawTimeout } from 'ember-concurrency';
import { A } from '@ember/array';
import config from '@cardstack/web-client/config/environment';
import { buildWaiter } from '@ember/test-waiters';
import RSVP, { defer } from 'rsvp';
import { UnbindEventListener } from '../utils/events';

let waiter = buildWaiter('thread-animation');
let token: any = null;
let waiting: RSVP.Deferred<void> | null = null;

let interval = 1000;
if (config.environment === 'test') {
  interval = 100;
} else if (
  config.environment === 'development' &&
  config.threadAnimationInterval
) {
  interval = config.threadAnimationInterval;
}

interface RevealResult {
  postable?: WorkflowPostable;
  revealed: boolean;
}

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

  containsPostable(postable: WorkflowPostable) {
    return this.postableCollection.containsPostable(postable);
  }

  resetTo(card: WorkflowPostable | undefined) {
    this.postableCollection.resetTo(card);
    this.isCompletionRevealed = false;
  }

  revealNext(): RevealResult {
    let result = this.postableCollection.revealNext();
    if (!result.revealed && !this.isCompletionRevealed) {
      this.isCompletionRevealed = true;
      result.revealed = true;
    }
    return result;
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

  get allPostablesVisible() {
    return (
      this.model.allNecessaryPostablesVisible &&
      this.model.peekAtVisiblePostables().length ===
        this.visiblePostables.length
    );
  }

  containsPostable(postable: WorkflowPostable) {
    return this.model.postables.includes(postable);
  }

  resetTo(card: WorkflowPostable | undefined) {
    if (!card || this.containsPostable(card)) this.revealPointer = card;
  }

  revealNext(): RevealResult {
    let postables = this.model.visiblePostables;
    let index = this.revealPointer
      ? postables.indexOf(this.revealPointer!)
      : -1;
    if (index === postables.length - 1) {
      return {
        revealed: false,
      };
    }
    this.revealPointer = postables[index + 1];
    return {
      revealed: true,
      postable: this.revealPointer,
    };
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
  #listenersToCleanUp: UnbindEventListener[] = [];

  constructor(model: Workflow) {
    this.model = model;
    // set this so css animations shorten their duration to at most the
    // rate of release
    // this is purely for devx
    document.documentElement.style.setProperty(
      '--thread-animation-interval',
      `${interval}ms`
    );
    this.#listenersToCleanUp.push(
      this.model.on(
        'visible-postables-changed',
        this.startTestWaiter.bind(this)
      )
    );
    this.#listenersToCleanUp.push(
      this.model.on('reset-postables', this.resetPointerTo.bind(this))
    );
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
    this.startTestWaiter();
    // short timeout to prevent moving revealpointer within the same runloop
    yield rawTimeout(10);

    while (true) {
      let result = this.revealNext();

      // the last card in these things is not completed so isComplete will never
      // be true. We check for completion by making sure all the things we need to
      // show are shown
      if (
        (this.isCanceled && this.cancelationMessages.allPostablesVisible) ||
        (this.isComplete && this.epilogue.allPostablesVisible)
      ) {
        this.stopTestWaiter();
        break;
      }

      if (result.postable && !result.postable.isComplete) {
        this.stopTestWaiter();
      }

      yield rawTimeout(interval);
    }
  }

  revealNext(): RevealResult {
    if (this.isCanceled) {
      return this.cancelationMessages.revealNext();
    }

    if (this.isComplete) {
      return this.epilogue.revealNext();
    }

    for (const animatedMilestone of this.visibleMilestones) {
      let result = animatedMilestone.revealNext();
      if (result.revealed) {
        return result;
      }
    }

    return {
      revealed: false,
    };
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
    if (this.isCanceled) {
      return 'Workflow canceled';
    }

    let completedMilestones = this.milestones.filterBy('isComplete');
    let lastMilestone = completedMilestones[completedMilestones.length - 1];
    return lastMilestone?.completedDetail ?? 'Workflow started';
  }

  resetPointerTo(card: WorkflowPostable) {
    if (this.isComplete) {
      this.epilogue.resetTo(card);
      return;
    }

    if (this.isCanceled) {
      this.cancelationMessages.resetTo(card);
      return;
    }

    let found = false;
    for (let milestone of this.milestones) {
      if (found) {
        milestone.resetTo(undefined);
        continue;
      }

      if (milestone.containsPostable(card)) {
        found = true;
        milestone.resetTo(card);
      }
    }
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
    this.#listenersToCleanUp.forEach((unbind) => unbind());
    taskFor(this.tickerTask).cancelAll();
    if (token) {
      waiting?.resolve();
      waiter.endAsync(token);
    }
  }
}
