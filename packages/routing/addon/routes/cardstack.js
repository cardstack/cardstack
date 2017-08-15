import Ember from 'ember';
import { defaultBranch } from '..';

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
