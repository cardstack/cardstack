// Builds on ember-simple-auth's session service by deriving a user
// model from the session state. Also handle partially authenticated sessions

import { alias } from '@ember/object/computed';

import { computed } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { singularize } from 'ember-inflector';

export default Service.extend({
  session: service(),
  store: service(),

  isAuthenticated: computed('session.isAuthenticated', 'isPartiallyAuthenticated', function() {
    return this.get('session.isAuthenticated') && !this.get('isPartiallyAuthenticated');
  }),

  creatableTypes: alias('_rawSession.data.meta.creatableTypes'),

  isPartiallyAuthenticated: alias('_rawSession.meta.partial-session'),

  partialSession: computed('isPartiallyAuthenticated', '_rawSession', function() {
    if (this.get('isPartiallyAuthenticated')) {
      return this.get('_rawSession');
    }
  }),

  partialAuthenticationMessage: alias('partialSession.data.attributes.message'),

  _rawSession: alias('session.data.authenticated'),

  user: computed('isAuthenticated', '_rawSession', function() {
    if (this.get('isAuthenticated')) {
      let rawSession = this.get('_rawSession');
      if (rawSession) {
        // pushPayload mutates its argument :-( so we are using JSON as a deepcopy here.
        this.get('store').pushPayload(JSON.parse(JSON.stringify(rawSession)));
        return this.get('store').peekRecord(singularize(rawSession.data.type), rawSession.data.id);
      }
    }
  }),

  token: computed('_rawSession', function() {
    return this.get('_rawSession.data.meta.token');
  }),

});
