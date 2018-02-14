import Ember from 'ember';
import Authorizer from 'ember-simple-auth/authorizers/base';

const { isEmpty } = Ember;

export default Authorizer.extend({
  authorize(rawSession, block) {
    const accessToken = Ember.get(rawSession, 'data.meta.token');

    if (!isEmpty(accessToken)) {
      block('Authorization', `Bearer ${accessToken}`);
    }
  }
});
