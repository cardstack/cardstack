import Component from '@glimmer/component';
import { action } from '@ember/object';

export default class WorkflowThread extends Component {
  threadEl: HTMLElement | undefined;
  @action focus(element: HTMLElement) {
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
}
