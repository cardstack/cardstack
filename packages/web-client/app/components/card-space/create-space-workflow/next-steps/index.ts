import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';
import { next } from '@ember/runloop';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';

class CreateSpaceWorkflowNextStepsComponent extends Component<WorkflowCardComponentArgs> {
  @service declare router: RouterService;

  @action async visitSpace() {
    let username = this.args.workflowSession.getValue('username');

    await this.router.transitionTo({
      queryParams: { flow: null, 'flow-id': null },
    });

    next(this, () => {
      this.router.transitionTo('card-space.userspace', { username });
    });

    return;
  }
}

export default CreateSpaceWorkflowNextStepsComponent;
