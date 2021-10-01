import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

import WorkflowPersistence from '@cardstack/web-client/services/workflow-persistence';
import { tracked } from '@glimmer/tracking';

interface CardPayHeaderWorkflowTrackerDropdownListArgs {}

export default class CardPayHeaderWorkflowTrackerDropdownList extends Component<CardPayHeaderWorkflowTrackerDropdownListArgs> {
  @service declare workflowPersistence: WorkflowPersistence;

  initialPosition?: number;
  @tracked currentPosition?: number;

  @action clearCompletedWorkflows() {
    this.workflowPersistence.completedWorkflows.forEach((workflowAndId) => {
      this.workflowPersistence.clearWorkflowWithId(workflowAndId.id);
    });
  }

  @action setEventListeners(element: HTMLElement) {
    let item =
      document.getElementById('workflow-tracker-active-list')
        ?.firstElementChild ??
      document.getElementById('workflow-tracker-completed-list')
        ?.firstElementChild;

    this.initialPosition = item?.getBoundingClientRect().top;

    element.onscroll = () => {
      this.currentPosition = item?.getBoundingClientRect().top;
    };
    element.onfocus = this._lockBodyScroll;
    element.onblur = this._unlockBodyScroll;
    element.onmouseover = this._lockBodyScroll;
    element.onmouseout = this._unlockBodyScroll;
  }

  get isScrolled() {
    return Boolean(
      this.currentPosition && this.currentPosition !== this.initialPosition
    );
  }

  _lockBodyScroll() {
    document.body.classList.add('has-modal');
  }

  _unlockBodyScroll() {
    document.body.classList.remove('has-modal');
  }
}
