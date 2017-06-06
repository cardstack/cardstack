// Builds on ember-simple-auth's session service by deriving a user
// model from the session state. Also handle partially authenticated sessions

import Ember from 'ember';
import { singularize } from 'ember-inflector';

export default Ember.Service.extend({
  session: Ember.inject.service(),
  store: Ember.inject.service(),

  isAuthenticated: Ember.computed('session.isAuthenticated', 'isPartiallyAuthenticated', function() {
    return this.get('session.isAuthenticated') && !this.get('isPartiallyAuthenticated');
  }),

  isPartiallyAuthenticated: Ember.computed.equal('_rawSession.data.type', 'partial-sessions'),

  message: Ember.computed.reads('_rawSession.data.attributes.message'),

  _rawSession: Ember.computed.alias('session.data.authenticated'),

  user: Ember.computed('isAuthenticated', '_rawSession', function() {
    if (this.get('isAuthenticated')) {
      let rawSession = this.get('_rawSession');
      if (rawSession) {
        // pushPayload mutates its argument :-( so we are using JSON as a deepcopy here.
        this.get('store').pushPayload(JSON.parse(JSON.stringify(rawSession)));
        return this.get('store').peekRecord(singularize(rawSession.data.type), rawSession.data.id);
      }
    }
  })

});
