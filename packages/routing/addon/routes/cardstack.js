import Ember from 'ember';

export default Ember.Route.extend({
  queryParams: {
    branch: {
      refreshMode: true
    }
  },

  model(params, transition) {
    let config = Ember.getOwner(this).resolveRegistration('config:environment');
    let { branch } = transition.queryParams;
    if (branch == null) {
      branch = config.cardstack.defaultBranch;
    }
    return { branch };
  }

});
