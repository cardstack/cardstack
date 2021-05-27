import Component from '@glimmer/component';
import { action } from '@ember/object';
import { Workflow } from '@cardstack/web-client/models/workflow';

interface WorkflowThreadArgs {
  workflow: Workflow;
}

export default class WorkflowThread extends Component<WorkflowThreadArgs> {
  threadEl: HTMLElement | undefined;
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

  get lastMilestonePostable() {
    return this.args.workflow.peekAtVisiblePostables().slice(-1)[0];
  }
}
