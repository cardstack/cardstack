import Ember from 'ember';
import Base from 'ember-simple-auth/authenticators/base';
import RSVP from 'rsvp';

export default Base.extend({
  cardstackSession: Ember.inject.service(),

  restore(rawSession) {
    return new RSVP.Promise((resolve, reject) => {
      if (rawSession && rawSession.meta &&
          rawSession.meta.validUntil &&
          rawSession.meta.validUntil > Date.now() / 1000
         ) {
        resolve(rawSession);
      } else {
        reject();
      }
    });
  },

  authenticate(authenticationSource, payload) {
    let config = Ember.getOwner(this).resolveRegistration('config:environment');
    let tokenExchangeUri = config.cardstack.apiURL + '/auth/' + authenticationSource;
    return fetch(tokenExchangeUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    }).then(response => response.json());
  },

  fetchConfig(authenticationSource) {
    let config = Ember.getOwner(this).resolveRegistration('config:environment');
    let tokenExchangeUri = config.cardstack.apiURL + '/auth/' + authenticationSource;
    return fetch(tokenExchangeUri).then(response => response.json());
  }
});
