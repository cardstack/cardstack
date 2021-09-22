import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';
import { next } from '@ember/runloop';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
class CardPayDepositWorkflowNextStepsComponent extends Component<WorkflowCardComponentArgs> {
  @service declare router: RouterService;

  @action async openNewDepositWorkflow() {
    await this.router.transitionTo({
      queryParams: { flow: null, 'flow-id': null },
    });
    next(this, () => {
      this.router.transitionTo({ queryParams: { flow: 'deposit' } });
    });
  }

  @action returnToDashboard() {
    this.router.transitionTo({
      queryParams: { flow: null, 'flow-id': null },
    });
  }
}

export default CardPayDepositWorkflowNextStepsComponent;
