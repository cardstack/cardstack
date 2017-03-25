import Ember from 'ember';

export default Ember.Route.extend({
  model(params) {
    let model = Object.assign({}, params, this.modelFor('cardstack'));
    return model;
  }
});
