import Route from '@ember/routing/route';
import { defaultBranch } from '@cardstack/plugin-utils/environment';

export default Route.extend({
  queryParams: {
    branch: {
      refreshModel: true
    }
  },

  model(params, transition) {
    let { branch } = transition.to.queryParams;
    if (branch == null) {
      branch = defaultBranch;
    }
    return { branch };
  }

});
