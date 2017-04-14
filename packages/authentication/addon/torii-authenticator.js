import Ember from 'ember';
import ToriiAuthenticator from 'ember-simple-auth/authenticators/torii';
import fetch from 'fetch';

export default ToriiAuthenticator.extend({
  torii: Ember.inject.service(),

  authenticate() {
    let config = Ember.getOwner(this).resolveRegistration('config:environment');
    let tokenExchangeUri = config.cardstack.tokenURL;
    return this._super(...arguments).then((data) => {
      return fetch(tokenExchangeUri, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          authorizationCode: data.authorizationCode
        })
      }).then(response => response.json()).then(response => {
        return {
          userDocument: response,
          provider: data.provider
        };
      });
    });
  }
});
