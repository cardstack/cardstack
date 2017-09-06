import Ember from 'ember';

export default Ember.Route.extend({
  service: Ember.inject.service('cardstack-routing'),

  model({ type }) {
    let branch = this.modelFor('cardstack').branch;
    return this.store.createRecord(this.get('service').modelType(type, branch));
  }
});
