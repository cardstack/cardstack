import Component from '@glimmer/component';
import { action } from '@ember/object';
import AnimatedWorkflow from '@cardstack/web-client/models/animated-workflow';
import { Workflow } from '@cardstack/web-client/models/workflow';
import { cached, tracked } from '@glimmer/tracking';
import config from '@cardstack/web-client/config/environment';
let interval = config.threadAnimationInterval;

interface WorkflowThreadArgs {
  workflow: Workflow;
}

export default class WorkflowThread extends Component<WorkflowThreadArgs> {
  threadEl: HTMLElement | undefined;
  @cached
  get workflow() {
    return new AnimatedWorkflow(
      this.args.workflow,
      this.threadAnimationInterval
    );
  }
  reducedMotionMediaQuery = window?.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );
  @tracked autoscroll = false;
  @tracked cssThreadAnimationInterval = '0ms';
  threadAnimationInterval = 0; // intentionally not tracked, so that we don't recompute the AnimatedWorkflow

  constructor(owner: unknown, args: any) {
    super(owner, args);
    this.setAnimationBehaviour(this.reducedMotionMediaQuery);
    this.reducedMotionMediaQuery.addEventListener(
      'change',
      this.setAnimationBehaviour
    );
  }

  // sets some animation behaviour
  // - autoscroll or not
  // - a css variable that controls the maximum duration of animation
  // - postable release interval on the AnimatedWorkflow
  @action setAnimationBehaviour(
    eventOrQueryObject: MediaQueryListEvent | MediaQueryList
  ) {
    if (eventOrQueryObject.matches) {
      // if prefers-reduced-motion, don't autoscroll, and release postables as soon as available
      // this puts control on when and how to scroll in users' hands
      this.autoscroll = false;
      this.threadAnimationInterval = 0;
    } else {
      // otherwise, turn on autoscrolling and use the interval defined in config
      this.autoscroll = true;
      this.threadAnimationInterval = interval;
    }
    this.cssThreadAnimationInterval = `${this.threadAnimationInterval}ms`;
    this.workflow.interval = this.threadAnimationInterval;
  }

  @action focus(element: HTMLElement): void {
    this.threadEl = element;
    element.focus();
  }

  @action scrollMilestoneIntoView(milestoneIndex: number, ev: Event) {
    ev.preventDefault();
    let milestoneEl = this.threadEl?.querySelector(
      `[data-milestone="${milestoneIndex}"]`
    );
    let targetEl =
      milestoneEl || this.threadEl?.querySelector('[data-thread-end]');
    targetEl?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }

  @action scrollToEnd() {
    this.threadEl
      ?.querySelector('[data-thread-end]')
      ?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }

  get mailToSupportUrl() {
    return config.urls.mailToSupportUrl;
  }

  get lastMilestonePostable() {
    let milestones = this.args.workflow.visibleMilestones;
    let postablesInLastMilestone =
      milestones[milestones.length - 1].peekAtVisiblePostables();

    return postablesInLastMilestone[postablesInLastMilestone.length - 1];
  }

  get frozen(): boolean {
    return this.workflow.isComplete || this.workflow.isCanceled;
  }

  willDestroy() {
    this.reducedMotionMediaQuery.removeEventListener(
      'change',
      this.setAnimationBehaviour
    );
    super.willDestroy();
    this.workflow.destroy();
  }
}
