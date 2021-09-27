import Controller from '@ember/controller';
import { action } from '@ember/object';
import RouterService from '@ember/routing/router-service';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';

export default class CardPayTokenSuppliersController extends Controller {
  queryParams = ['flow', { workflowPersistenceId: 'flow-id' }];
  @tracked flow: string | null = null;
  @tracked workflowPersistenceId: string | null = null;
  @service declare router: RouterService;

  @action transitionToTokenSuppliers(flow: string) {
    this.router.transitionTo('card-pay.token-suppliers', {
      queryParams: { flow },
    });
  }

  @action resetQueryParams() {
    this.flow = null;
    this.workflowPersistenceId = null;
  }
}
