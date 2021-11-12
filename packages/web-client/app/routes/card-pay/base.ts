import Route from '@ember/routing/route';
import '../../css/card-pay/wallet.css';
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
      // TODO: remove me once all flows have persistence support
      if (
        params.flow !== 'deposit' &&
        params.flow !== 'issue-prepaid-card' &&
        params.flow !== 'create-business' &&
        params.flow !== 'withdrawal'
      )
        return;

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
