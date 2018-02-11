import Ember from 'ember';
import { task } from 'ember-concurrency';

export default Ember.Service.extend({
  session: Ember.inject.service(),

  source: 'mock-auth',

  init() {
    this._super();

    if (window && window.location && window.location.search) {
      let urlParams = new URLSearchParams(window.location.search);
      let mockUserId = urlParams.get("mock-user");
      if (mockUserId) {
        this.set('mockUserId', mockUserId);
      }
    }
  },

  login: task(function * (mockUserId) {
    mockUserId = this.get('mockUserId') || mockUserId;
    if (mockUserId ) {
      yield this.get('session').authenticate('authenticator:cardstack', this.get('source'), { authorizationCode: mockUserId });
    }
  }).drop()
});

