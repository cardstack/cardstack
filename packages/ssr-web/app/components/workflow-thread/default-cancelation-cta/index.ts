import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';
import * as short from 'short-uuid';

class WorkflowThreadDefaultCancelationCta extends Component {
  @service declare router: RouterService;

  get currentWorkflow() {
    return this.router.currentRoute?.queryParams?.flow;
  }

  @action async restartWorkflow() {
    const { queryParams } = this.router.currentRoute;
    await this.router.transitionTo({
      queryParams: Object.assign({}, queryParams, {
        'flow-id': short.generate(),
      }),
    });
  }
}

export default WorkflowThreadDefaultCancelationCta;
