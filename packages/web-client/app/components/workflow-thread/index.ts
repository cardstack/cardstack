import Component from '@glimmer/component';
import { action } from '@ember/object';
import AnimatedWorkflow from '@cardstack/web-client/models/animated-workflow';
import { Workflow } from '@cardstack/web-client/models/workflow';
import { tracked } from '@glimmer/tracking';
import config from '@cardstack/web-client/config/environment';
let interval = config.threadAnimationInterval;

interface WorkflowThreadArgs {
  workflow: Workflow;
}
export default class WorkflowThread extends Component<WorkflowThreadArgs> {
  threadEl: HTMLElement | undefined;
  workflow = new AnimatedWorkflow(this.args.workflow);
  reducedMotionMediaQuery = window?.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );
  @tracked autoscroll = false;
  @tracked threadAnimationInterval = '0ms';

  constructor(owner: unknown, args: any) {
    super(owner, args);
    this.setAutoscroll(this.reducedMotionMediaQuery);
    this.reducedMotionMediaQuery.addEventListener('change', this.setAutoscroll);
  }

  @action setAutoscroll(
    eventOrQueryObject: MediaQueryListEvent | MediaQueryList
  ) {
    if (eventOrQueryObject.matches) {
      this.autoscroll = false;
      this.workflow.interval = 0;
      this.threadAnimationInterval = `0ms`;
    } else {
      this.autoscroll = true;
      this.workflow.interval = interval;
      this.threadAnimationInterval = `${interval}ms`;
    }
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

  get lastMilestonePostable() {
    let milestones = this.args.workflow.visibleMilestones;
    let postablesInLastMilestone = milestones[
      milestones.length - 1
    ].peekAtVisiblePostables();

    return postablesInLastMilestone[postablesInLastMilestone.length - 1];
  }

  willDestroy() {
    this.reducedMotionMediaQuery.removeEventListener(
      'change',
      this.setAutoscroll
    );
    super.willDestroy();
    this.workflow.destroy();
  }
}
