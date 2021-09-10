import Route from '@ember/routing/route';
import '../../css/card-pay/balances.css';
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
  model(params: any, transition: any) {
    if (params.flow && !params.workflowPersistenceId) {
      transition.abort();
      this.transitionTo(this.routeName, {
        queryParams: {
          flow: params.flow,
          workflowPersistenceId: short.generate(),
        },
      });
    }
  }
}
