import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';
import { next } from '@ember/runloop';

class WorkflowThreadDisconnectionComponent extends Component {
  @service declare router: RouterService;

  get currentWorkflow() {
    return this.router.currentRoute?.queryParams?.flow;
  }

  @action async restartWorkflow() {
    const { queryParams } = this.router.currentRoute;
    await this.router.transitionTo({ queryParams: { flow: null } });
    next(this, () => {
      this.router.transitionTo({
        queryParams,
      });
    });
  }
}

export default WorkflowThreadDisconnectionComponent;
