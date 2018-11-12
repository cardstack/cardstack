import { warn } from '@ember/debug';
import { inject as service } from '@ember/service';
import { get } from '@ember/object';
import Base from 'ember-simple-auth/authenticators/base';
import RSVP from 'rsvp';
import { hubURL } from '@cardstack/plugin-utils/environment';

const clientId = Math.floor(Math.random() * 10000000000);
const validTokenGracePeriod = 10 * 1000;

export default Base.extend({
  cardstackSession: service(),
  session: service(),

  async restore(rawSession) {
    return new RSVP.Promise((resolve, reject) => {
      let potentiallyValidSession =
        rawSession &&
        rawSession.data &&
        rawSession.data.meta &&
        rawSession.data.meta.validUntil &&
        rawSession.data.meta.validUntil > Date.now() / 1000;

      let { token: prevToken, clientId: tokenClientId, issued: tokenIssued } = JSON.parse(
        localStorage.getItem('cardstack-prev-token') || '{}',
      );
      if (
        prevToken &&
        prevToken === get(rawSession, 'data.meta.prevToken') &&
        clientId !== tokenClientId &&
        Date.now() - tokenIssued < validTokenGracePeriod
      ) {
        // cardstack app is running in another tab, just return the session you have
        resolve(rawSession);
        return;
      }
      let partialSession = rawSession.meta && rawSession.meta['partial-session'];

      let secret = localStorage.getItem('cardstack-secret-token'),
        authenticationSource = localStorage.getItem('cardstack-authentication-source');

      if (!potentiallyValidSession && secret && authenticationSource) {
        localStorage.removeItem('cardstack-secret-token'), localStorage.removeItem('cardstack-authentication-source');
        this.authenticate(authenticationSource, { secret }).then(resolve, reject);
      } else if (potentiallyValidSession && authenticationSource) {
        // dont assume the session you have is valid just because session token hasn't yet expired
        localStorage.removeItem('cardstack-authentication-source');
        let {
          meta: { token },
        } = rawSession.data;
        fetch(`${hubURL}/auth/${authenticationSource}/status`, {
          method: 'GET',
          headers: { authorization: `Bearer ${token}` },
        }).then(response => {
          if (response.status === 200) {
            localStorage.setItem(
              'cardstack-prev-token',
              JSON.stringify({
                token,
                clientId,
                issued: Date.now(),
              }),
            );
            localStorage.setItem('cardstack-authentication-source', authenticationSource);
            resolve(response.json());
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
      body: JSON.stringify(payload),
    }).then(response => {
      if (response.status === 401) {
        return response.json().then(body => {
          throw new Error(body.errors[0].detail);
        });
      }
      if (response.status !== 200) {
        throw new Error('Authentication attempt failed');
      }

      localStorage.setItem('cardstack-authentication-source', authenticationSource);

      if (
        response.headers.get('content-type') &&
        response.headers
          .get('content-type')
          .toLowerCase()
          .indexOf('application/json') >= 0
      ) {
        return response.json();
      } else {
        warn(`Got a non-json response from ${hubURL}/auth/${authenticationSource}`, false, {
          id: 'cardstack-authentication-nonjson-response',
        });
        return {};
      }
    });
  },

  fetchConfig(authenticationSource) {
    let tokenExchangeUri = hubURL + '/auth/' + authenticationSource;
    return fetch(tokenExchangeUri).then(response => response.json());
  },
});
