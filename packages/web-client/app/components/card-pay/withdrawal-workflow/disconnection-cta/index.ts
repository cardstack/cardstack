import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';
import { next } from '@ember/runloop';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';

class CardPayWithdrawalWorkflowCanceledComponent extends Component<WorkflowCardComponentArgs> {
  @service declare router: RouterService;

  @action async openNewWithdrawalWorkflow() {
    await this.router.transitionTo({ queryParams: { flow: null } });
    next(this, () => {
      this.router.transitionTo({ queryParams: { flow: 'withdrawal' } });
    });
  }
}

export default CardPayWithdrawalWorkflowCanceledComponent;
