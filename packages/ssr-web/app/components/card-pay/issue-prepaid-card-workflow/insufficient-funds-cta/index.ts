import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';

class CardPayIssuePrepaidCardWorkflowInsufficientFundsComponent extends Component {
  @service declare router: RouterService;

  @action async openDepositWorkflow() {
    this.router.transitionTo('card-pay.deposit-withdrawal', {
      queryParams: { flow: 'deposit' },
    });
  }
}

export default CardPayIssuePrepaidCardWorkflowInsufficientFundsComponent;
