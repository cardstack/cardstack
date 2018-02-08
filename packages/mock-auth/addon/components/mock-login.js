import Ember from 'ember';
import layout from '../templates/components/mock-login';
import { task } from 'ember-concurrency';

export default Ember.Component.extend({
  layout,
  tagName: '',
  session: Ember.inject.service(),

  source: 'mock-auth',

  init() {
    this._super();

    if (window && window.location && window.location.search) {
      let urlParams = new URLSearchParams(window.location.search);
      let mockUserId = urlParams.get("mock-user");
      this.set('mockUserId', mockUserId);
    }
  },

  login: task(function * (mockUserId) {
    mockUserId = mockUserId || this.get('mockUserId');
    if (mockUserId ) {
      yield this.get('session').authenticate('authenticator:cardstack', this.get('source'), { authorizationCode: mockUserId });
    }
  }).drop()
});
