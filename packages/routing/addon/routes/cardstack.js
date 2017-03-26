import Ember from 'ember';

export default Ember.Route.extend({
  cardstackRouting: Ember.inject.service(),

  queryParams: {
    branch: {
      refreshModel: true
    }
  },

  model(params, transition) {
    let { branch } = transition.queryParams;
    if (branch == null) {
      branch = this.get('cardstackRouting.config.defaultBranch');
    }
    return { branch };
  }

});
