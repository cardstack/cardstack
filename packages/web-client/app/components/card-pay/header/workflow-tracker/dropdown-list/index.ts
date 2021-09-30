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

    let item = document.getElementById('active-list')?.firstElementChild;
    this.initialPosition = item?.getBoundingClientRect().top;

    element?.addEventListener('scroll', () => {
      this.currentPosition = item?.getBoundingClientRect().top;
    });
  }

  get isScrolled() {
    return Boolean(
      this.currentPosition && this.currentPosition !== this.initialPosition
    );
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
