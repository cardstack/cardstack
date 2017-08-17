import Ember from 'ember';

export default Ember.Route.extend({
  model() {
    return {
      myPost: this.store.createRecord('post', { id: '123 45' }),
      myPage: this.store.createRecord('page', { permalink: 'the-permalink' }),
    }
  }
});
