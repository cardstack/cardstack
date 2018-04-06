import Service, { inject as service } from '@ember/service';
import { task } from 'ember-concurrency';

export default Service.extend({
  session: service(),

  source: 'mock-auth',

  login: task(function * (mockUserId) {
    mockUserId = this.get('mockUserId') || mockUserId;
    if (mockUserId ) {
      yield this.get('session').authenticate('authenticator:cardstack', this.get('source'), { authorizationCode: mockUserId });
    }
  }).drop()
});

