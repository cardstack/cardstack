import Ember from 'ember';

export default Ember.Route.extend({
  queryParams: {
    branch: {
      refreshMode: true,
      default: 'master'
    }
  },

  model({ id }, transition) {
    let { branch } = transition.queryParams;
    return this.get('store').queryRecord('page', {
      branch,
      filter: { id }
    });
  }
});
