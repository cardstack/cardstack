import Component from '@glimmer/component';
import { action } from '@ember/object';
import AnimatedWorkflow from '@cardstack/web-client/models/animated-workflow';
import { Workflow } from '@cardstack/web-client/models/workflow';

interface WorkflowThreadArgs {
  workflow: Workflow;
}
export default class WorkflowThread extends Component<WorkflowThreadArgs> {
  threadEl: HTMLElement | undefined;
  workflow: Workflow | AnimatedWorkflow;

  constructor(owner: unknown, args: any) {
    super(owner, args);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.workflow = this.args.workflow;
    } else {
      this.workflow = new AnimatedWorkflow(this.args.workflow);
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
    super.willDestroy();
    if (this.workflow instanceof AnimatedWorkflow) this.workflow.destroy();
  }
}
