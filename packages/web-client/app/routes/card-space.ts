import Route from '@ember/routing/route';
import * as short from 'short-uuid';

export default class CardSpaceRoute extends Route {
  queryParams = {
    flow: {
      refreshModel: true,
    },
    workflowPersistenceId: {
      refreshModel: true,
    },
  };

  async model(params: any, transition: any) {
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
