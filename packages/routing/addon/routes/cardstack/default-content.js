import Ember from 'ember';

export default Ember.Route.extend({
  model(params) {
    return Ember.assign({}, params, this.modelFor('cardstack'));
  }
});
