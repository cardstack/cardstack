import Ember from 'ember';
import ToriiAuthenticator from 'ember-simple-auth/authenticators/torii';

export default ToriiAuthenticator.extend({
  torii: Ember.inject.service(),
  cardstackSession: Ember.inject.service(),

  authenticate() {
    return this._super(...arguments).then(data => {
      return this.get('cardstackSession').authenticate('github', data)
        .then(userDocument => {
          return {
            userDocument,
            provider: data.provider
          };
        });
    });
  }
});
