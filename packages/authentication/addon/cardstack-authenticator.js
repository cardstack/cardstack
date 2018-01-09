import Ember from 'ember';
import Base from 'ember-simple-auth/authenticators/base';
import RSVP from 'rsvp';
import { hubURL } from '@cardstack/plugin-utils/environment';

export default Base.extend({
  cardstackSession: Ember.inject.service(),
  session: Ember.inject.service(),

  restore(rawSession) {
    return new RSVP.Promise((resolve, reject) => {
      let validSession =
        rawSession && rawSession.data && rawSession.data.meta &&
        rawSession.data.meta.validUntil &&
        rawSession.data.meta.validUntil > Date.now() / 1000;

      let partialSession =
        rawSession.data &&
        rawSession.data.type === 'partial-sessions';

      let secret             = localStorage.getItem('cardstack-secret-token'),
        authenticationSource = localStorage.getItem('cardstack-authentication-source');

      if ( !validSession && secret && authenticationSource ) {
        localStorage.removeItem('cardstack-secret-token'),
        localStorage.removeItem('cardstack-authentication-source');
        this.authenticate( authenticationSource, { secret }).then(resolve, reject);
      } else if ( validSession || partialSession ) {
        resolve(rawSession);
      } else {
        reject();
      }
    });
  },

  authenticate(authenticationSource, payload) {
    let tokenExchangeUri = hubURL + '/auth/' + authenticationSource;
    return fetch(tokenExchangeUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    }).then(response => {
      if (response.status !== 200) {
        throw new Error("Authentication attempt failed");
      }
      if(response.headers.get("content-type") &&
         response.headers.get("content-type").toLowerCase().indexOf("application/json") >= 0) {
        return response.json()
      } else {
        Ember.warn(`Got a non-json response from ${hubURL}/auth/${authenticationSource}`, false, { id: 'cardstack-authentication-nonjson-response' });
        return {};
      }
    });
  },

  fetchConfig(authenticationSource) {
    let tokenExchangeUri = hubURL + '/auth/' + authenticationSource;
    return fetch(tokenExchangeUri).then(response => response.json());
  }
});
