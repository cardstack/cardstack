// Builds on ember-simple-auth's session service by deriving a user
// model from the session state.

import Ember from 'ember';
import { singularize } from 'ember-inflector';
import fetch from 'fetch';

export default Ember.Service.extend({
  session: Ember.inject.service(),
  store: Ember.inject.service(),

  isAuthenticated: Ember.computed.alias('session.isAuthenticated'),

  _rawSession: Ember.computed.alias('session.data.authenticated'),

  user: Ember.computed('isAuthenticated', '_rawSession', function() {
    if (this.get('isAuthenticated')) {
      let rawSession = this.get('_rawSession');
      if (rawSession) {
        // pushPayload mutates its argument :-( so we are using JSON as a deepcopy here.
        this.get('store').pushPayload(JSON.parse(JSON.stringify(rawSession.userDocument)));
        return this.get('store').peekRecord(singularize(rawSession.userDocument.data.type), rawSession.userDocument.data.id);
      }
    }
  }),

  // authentication plugins should call this as their bridge to the
  // server side. authenticationSource is the name of the configured authentication-source
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
  }
});
