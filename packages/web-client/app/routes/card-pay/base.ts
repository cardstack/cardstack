import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';
import '../../css/card-pay/index.css';
import * as short from 'short-uuid';

export default class CardPayTabBaseRoute extends Route {
  queryParams = {
    flow: {
      refreshModel: true,
    },
    workflowPersistenceId: {
      refreshModel: true,
    },
  };

  @service declare router: RouterService;

  model(params: any, _transition: any) {
    if (params.flow && !params.workflowPersistenceId) {
      // TODO: remove me once all flows have persistence support
      if (
        params.flow !== 'deposit' &&
        params.flow !== 'issue-prepaid-card' &&
        params.flow !== 'create-business' &&
        params.flow !== 'withdrawal'
      )
        return;

      this.router.transitionTo(this.routeName, {
        queryParams: {
          flow: params.flow,
          workflowPersistenceId: short.generate(),
        },
      });
    }
  }
}
