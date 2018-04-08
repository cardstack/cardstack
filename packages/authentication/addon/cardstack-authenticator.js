import { warn } from '@ember/debug';
import { inject as service } from '@ember/service';
import Base from 'ember-simple-auth/authenticators/base';
import RSVP from 'rsvp';
import { hubURL } from '@cardstack/plugin-utils/environment';

export default Base.extend({
  cardstackSession: service(),
  session: service(),

  async restore(rawSession) {
    return new RSVP.Promise((resolve, reject) => {
      let potentiallyValidSession =
        rawSession && rawSession.data && rawSession.data.meta &&
        rawSession.data.meta.validUntil &&
        rawSession.data.meta.validUntil > Date.now() / 1000;

      let partialSession =
        rawSession.meta &&
        rawSession.meta['partial-session'];

      let secret             = localStorage.getItem('cardstack-secret-token'),
        authenticationSource = localStorage.getItem('cardstack-authentication-source');

      if (!potentiallyValidSession && secret && authenticationSource ) {
        localStorage.removeItem('cardstack-secret-token'),
        localStorage.removeItem('cardstack-authentication-source');
        this.authenticate( authenticationSource, { secret }).then(resolve, reject);
      } else if (potentiallyValidSession) {
        // dont assume the session you have is valid just because session token hasn't yet expired
        // attempt to fetch the user model that you posses to confirm the session is valid
        let { type, id, meta: { token } } = rawSession.data;
        fetch(`${hubURL}/api/${type}/${id}`, {
          method: 'GET',
          headers: { 'authorization': `Bearer ${token}` }
        }).then(response => {
          if (response.status === 200) {
            resolve(rawSession);
          } else {
            reject();
          }
        });
      } else if (partialSession) {
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
        warn(`Got a non-json response from ${hubURL}/auth/${authenticationSource}`, false, { id: 'cardstack-authentication-nonjson-response' });
        return {};
      }
    });
  },

  fetchConfig(authenticationSource) {
    let tokenExchangeUri = hubURL + '/auth/' + authenticationSource;
    return fetch(tokenExchangeUri).then(response => response.json());
  }
});
