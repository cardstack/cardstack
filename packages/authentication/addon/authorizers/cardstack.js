import { get } from '@ember/object';
import { isEmpty } from '@ember/utils';
import Authorizer from 'ember-simple-auth/authorizers/base';

export default Authorizer.extend({
  authorize(rawSession, block) {
    const accessToken = get(rawSession, 'data.meta.token');

    if (!isEmpty(accessToken)) {
      block('Authorization', `Bearer ${accessToken}`);
    }
  }
});
