import Ember from 'ember';
import Authorizer from 'ember-simple-auth/authorizers/base';

const { isEmpty } = Ember;

export default Authorizer.extend({
  authorize(data, block) {
    const accessToken = data.meta.token;

    if (!isEmpty(accessToken)) {
      block('Authorization', `Bearer ${accessToken}`);
    }
  }
});