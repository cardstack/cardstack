import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';

class CardPayIssuePrepaidCardWorkflowInsufficientFundsComponent extends Component {
  @service declare router: RouterService;

  @action async openCreateBusinessAccountWorkflow() {
    this.router.transitionTo('card-pay.payments', {
      queryParams: { flow: 'create-business' },
    });
  }
}

export default CardPayIssuePrepaidCardWorkflowInsufficientFundsComponent;
