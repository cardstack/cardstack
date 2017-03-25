import Ember from 'ember';

export default Ember.Route.extend({
  model(params) {
    return Object.assign({}, params, this.modelFor('cardstack'));
  }
});
