import Ember from 'ember';
import { task } from 'ember-concurrency';

export default Ember.Service.extend({
  session: Ember.inject.service(),

  source: 'mock-auth',

  login: task(function * (mockUserId) {
    mockUserId = this.get('mockUserId') || mockUserId;
    if (mockUserId ) {
      yield this.get('session').authenticate('authenticator:cardstack', this.get('source'), { authorizationCode: mockUserId });
    }
  }).drop()
});

