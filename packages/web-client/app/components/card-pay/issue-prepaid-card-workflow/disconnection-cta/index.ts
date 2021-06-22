import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';
import { next } from '@ember/runloop';

class CardPayIssuePrepaidCardWorkflowDisconnectionComponent extends Component {
  @service declare router: RouterService;

  @action async openNewPrepaidCardWorkflow() {
    await this.router.transitionTo({ queryParams: { flow: null } });
    next(this, () => {
      this.router.transitionTo({ queryParams: { flow: 'issue-prepaid-card' } });
    });
  }
}

export default CardPayIssuePrepaidCardWorkflowDisconnectionComponent;
