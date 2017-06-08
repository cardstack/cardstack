import Ember from 'ember';

export default Ember.Route.extend({
  async model({ id }) {
    return this.store.findRecord('post', id);
  }
});
