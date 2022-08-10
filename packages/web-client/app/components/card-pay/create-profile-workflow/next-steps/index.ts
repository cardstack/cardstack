import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';

class CardPayCreateProfileWorkflowNextStepsComponent extends Component<WorkflowCardComponentArgs> {
  @service declare router: RouterService;

  @action returnToDashboard() {
    this.router.transitionTo({
      queryParams: { flow: null, 'flow-id': null },
    });
  }
}

export default CardPayCreateProfileWorkflowNextStepsComponent;
