import Ember from 'ember';
import { singularize } from 'ember-inflector';

export default Ember.Service.extend({
  session: Ember.inject.service(),
  store: Ember.inject.service(),

  isAuthenticated: Ember.computed.alias('session.isAuthenticated'),

  _rawSession: Ember.computed.alias('session.data.authenticated'),

  user: Ember.computed('isAuthenticated', '_rawSession', function() {
    if (this.get('isAuthenticated')) {
      let rawSession = this.get('_rawSession');
      if (rawSession) {
        // pushPayload mutates its argument :-(
        this.get('store').pushPayload(JSON.parse(JSON.stringify(rawSession.userDocument)));
        return this.get('store').peekRecord(singularize(rawSession.userDocument.data.type), rawSession.userDocument.data.id);
      }
    }
  })
});
