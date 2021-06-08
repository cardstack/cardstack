import Component from '@glimmer/component';
import { action } from '@ember/object';
import { Workflow } from '@cardstack/web-client/models/workflow';
import { buildWaiter } from '@ember/test-waiters';

let waiter = buildWaiter('testing-waiter');

interface WorkflowThreadArgs {
  workflow: Workflow;
}

export default class WorkflowThread extends Component<WorkflowThreadArgs> {
  threadEl: HTMLElement | undefined;

  constructor(owner: unknown, args: any) {
    super(owner, args);

    let token = waiter.beginAsync();
    waiter.endAsync(token);
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
}
