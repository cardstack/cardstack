import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';

class CardPayCreateMerchantWorkflowNextStepsComponent extends Component<WorkflowCardComponentArgs> {
  @service declare router: RouterService;

  @action returnToDashboard() {
    this.router.transitionTo({ queryParams: { flow: null } });
  }
}

export default CardPayCreateMerchantWorkflowNextStepsComponent;
