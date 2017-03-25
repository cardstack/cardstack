import Ember from 'ember';
const defaultBranch = 'master';

export default Ember.Route.extend({
  queryParams: {
    branch: {
      refreshMode: true,
      default: defaultBranch
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
