import Ember from 'ember';
import { defaultBranch } from '@cardstack/plugin-utils/environment';

export default Ember.Route.extend({
  queryParams: {
    branch: {
      refreshModel: true
    }
  },

  model(params, transition) {
    let { branch } = transition.queryParams;
    if (branch == null) {
      branch = defaultBranch;
    }
    return { branch };
  }

});
