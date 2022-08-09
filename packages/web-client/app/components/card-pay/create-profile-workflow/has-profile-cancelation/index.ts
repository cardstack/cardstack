import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';

class WorkflowThreadDefaultCancelationCta extends Component {
  @service declare router: RouterService;

  @action async closeWorkflow() {
    await this.router.transitionTo({
      queryParams: {
        flow: null,
        'flow-id': null,
      },
    });
  }
}

export default WorkflowThreadDefaultCancelationCta;
