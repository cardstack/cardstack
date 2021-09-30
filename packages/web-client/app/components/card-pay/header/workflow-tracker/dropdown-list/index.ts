import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import { tracked } from '@glimmer/tracking';

interface CardPayHeaderWorkflowTrackerDropdownListArgs {}

export default class CardPayHeaderWorkflowTrackerDropdownList extends Component<CardPayHeaderWorkflowTrackerDropdownListArgs> {
  @service declare workflowPersistence: WorkflowPersistence;
  element!: HTMLElement;
  initialPosition?: number;
  @tracked currentPosition?: number;

  @action getScrollPosition(element: HTMLElement) {
    this.element = element;

    let item =
      document.getElementById('workflow-tracker-active-list')
        ?.firstElementChild ??
      document.getElementById('workflow-tracker-completed-list')
        ?.firstElementChild;
    this.initialPosition = item?.getBoundingClientRect().top;

    element.addEventListener('scroll', () => {
      this.currentPosition = item?.getBoundingClientRect().top;
    });

    element.onfocus = this.lockBodyScroll;
    element.onblur = this.unlockBodyScroll;
    element.onmouseover = this.lockBodyScroll;
    element.onmouseout = this.unlockBodyScroll;
  }

  get isScrolled() {
    return Boolean(
      this.currentPosition && this.currentPosition !== this.initialPosition
    );
  }

  lockBodyScroll() {
    let body = document.getElementsByTagName('body')[0];
    body.classList.add('has-modal');
  }

  unlockBodyScroll() {
    let body = document.getElementsByTagName('body')[0];
    body.classList.remove('has-modal');
  }

  @action clearCompletedWorkflows() {
    this.workflowPersistence.completedWorkflows.forEach((workflowAndId) => {
      this.workflowPersistence.clearWorkflowWithId(workflowAndId.id);
    });
  }

  willDestroy() {
    super.willDestroy();
    this.initialPosition = undefined;
    this.currentPosition = undefined;
    this.element?.removeEventListener('scroll', () => {});
  }
}
