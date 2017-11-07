import Ember from 'ember';
import layout from '../templates/components/mock-login';
import { task } from 'ember-concurrency';

export default Ember.Component.extend({
  layout,
  tagName: '',
  session: Ember.inject.service(),

  source: 'mock-auth',

  login: task(function * (mockUserId) {
    if (mockUserId) {
      yield this.get('session').authenticate('authenticator:cardstack', this.get('source'), { authorizationCode: mockUserId });
    }
  }).drop()
});
